'use client';

import { useMutation } from '@apollo/client';
import {
  Crop,
  ImagePlus,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { AdminPageActions } from '@/components/admin/page-actions';
import { ShareArtAreaEditor } from '@/components/admin/share-art-area-editor';
import { ShareArtBackgroundCropDialog } from '@/components/admin/share-art-background-crop-dialog';
import { useUnsavedChanges } from '@/components/admin/unsaved-guard';
import { CustomArtCanvas } from '@/components/share-art/custom-art-canvas';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { UPSERT_SHARE_ART_CONFIG } from '@/lib/queries';
import {
  SHARE_ART_FORMATS,
  sameOriginImageUrl,
  type ShareArtFormat,
} from '@/lib/share-art';
import {
  SHARE_ART_FORMAT_KEYS,
  backgroundProblem,
  cropSourceProblem,
  customFormatOf,
  defaultPhotoArea,
  formatInput,
  imageRatioOf,
  isSquareArea,
  ratioMatches,
  squareArea,
  type ShareArtConfig,
  type ShareArtPhotoArea,
} from '@/lib/share-art-config';
import { SAMPLE_PHOTO_URL, readImageSize } from '@/lib/share-art-custom';
import { preparePhoto } from '@/lib/share-art-image';
import { uploadFiles } from '@/lib/upload';

const FORM_ID = 'share-art-config-form';

interface FormatState {
  backgroundId: string | null;
  backgroundUrl: string | null;
  area: ShareArtPhotoArea;
  square: boolean;
}

type FormState = Record<ShareArtFormat, FormatState>;

export function toFormState(
  config: ShareArtConfig | null | undefined
): FormState {
  const state = {} as FormState;
  SHARE_ART_FORMAT_KEYS.forEach(format => {
    const custom = customFormatOf(config, format);
    const area = custom?.photo_area ?? defaultPhotoArea(format);
    state[format] = {
      backgroundId: custom?.background_id ?? null,
      backgroundUrl: custom?.background ?? null,
      area,
      square: isSquareArea(area, imageRatioOf(format)),
    };
  });
  return state;
}

/** What the save sends: the local blob URL and the "square" switch are editor state only. */
const savedShape = (state: FormState) =>
  JSON.stringify(
    SHARE_ART_FORMAT_KEYS.map(format =>
      formatInput({
        backgroundId: state[format].backgroundId,
        area: state[format].area,
      })
    )
  );

function errorMessage(err: unknown): string {
  const apolloErr = err as {
    graphQLErrors?: { message?: string }[];
    networkError?: unknown;
  };
  if (apolloErr?.graphQLErrors?.[0]?.message)
    return apolloErr.graphQLErrors[0].message;
  if (apolloErr?.networkError)
    return 'Não foi possível concluir. Tente novamente.';
  if (err instanceof Error && err.message) return err.message;
  return 'Não foi possível concluir. Tente novamente.';
}

const PREVIEW_WIDTH = 220;

interface ShareArtConfigFormProps {
  eventId: string;
  initialConfig: ShareArtConfig | null | undefined;
  onSaved: (config: ShareArtConfig | null) => void;
}

export function ShareArtConfigForm({
  eventId,
  initialConfig,
  onSaved,
}: ShareArtConfigFormProps) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(() => toFormState(initialConfig));
  const [state, setState] = useState(saved);
  const [format, setFormat] = useState<ShareArtFormat>('story');
  const [uploading, setUploading] = useState<ShareArtFormat | null>(null);
  const [problems, setProblems] = useState<
    Partial<Record<ShareArtFormat, string>>
  >({});
  const [samplePhoto, setSamplePhoto] = useState<string>(SAMPLE_PHOTO_URL);
  const fileInputs = useRef<
    Partial<Record<ShareArtFormat, HTMLInputElement | null>>
  >({});
  const sampleInput = useRef<HTMLInputElement>(null);
  const blobUrls = useRef<string[]>([]);
  // REA-45: the image each background was cropped from, so "Recortar" starts again from the original
  // instead of cropping a crop. Unset for a background saved earlier (then its proxied URL is used).
  const originals = useRef<Partial<Record<ShareArtFormat, string>>>({});
  const [cropping, setCropping] = useState<{
    format: ShareArtFormat;
    src: string;
    wrongRatio: { width: number; height: number } | null;
  } | null>(null);

  useEffect(() => {
    const next = toFormState(initialConfig);
    setSaved(next);
    setState(next);
  }, [initialConfig]);

  useEffect(
    () => () => blobUrls.current.forEach(url => URL.revokeObjectURL(url)),
    []
  );

  const dirty = useMemo(
    () => savedShape(state) !== savedShape(saved),
    [state, saved]
  );
  useUnsavedChanges(dirty, () => false);

  const [upsert, { loading: saving }] = useMutation<{
    upsertShareArtConfig: ShareArtConfig | null;
  }>(UPSERT_SHARE_ART_CONFIG);

  const update = (key: ShareArtFormat, patch: Partial<FormatState>) =>
    setState(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const objectUrl = (file: Blob) => {
    const url = URL.createObjectURL(file);
    blobUrls.current.push(url);
    return url;
  };

  /** Uploads a background already in the format's ratio and size (checked by the caller). */
  const uploadBackground = async (
    key: ShareArtFormat,
    file: File,
    original: string
  ) => {
    setUploading(key);
    try {
      const [id] = await uploadFiles(file);
      const url = objectUrl(file);
      originals.current[key] = original;
      setState(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          backgroundId: id,
          backgroundUrl: url,
          // A first background starts with the default circle; a new one keeps the area.
          ...(prev[key].backgroundId
            ? {}
            : { area: defaultPhotoArea(key), square: true }),
        },
      }));
    } catch (err) {
      setProblems(prev => ({ ...prev, [key]: errorMessage(err) }));
    } finally {
      setUploading(null);
    }
  };

  const handleBackground = async (
    key: ShareArtFormat,
    file: File | undefined
  ) => {
    if (!file) return;
    setProblems(prev => ({ ...prev, [key]: undefined }));
    if (!file.type.startsWith('image/')) {
      setProblems(prev => ({
        ...prev,
        [key]: 'Escolha um arquivo de imagem (PNG ou JPG).',
      }));
      return;
    }
    let size: { width: number; height: number };
    try {
      size = await readImageSize(file);
    } catch (err) {
      setProblems(prev => ({ ...prev, [key]: errorMessage(err) }));
      return;
    }
    const { width, height } = size;
    if (!ratioMatches(width, height, imageRatioOf(key))) {
      // Another ratio: crop it to the format (REA-45) — unless even the widest crop is too narrow.
      const tooSmall = cropSourceProblem(key, width, height);
      if (tooSmall) {
        setProblems(prev => ({ ...prev, [key]: tooSmall }));
        return;
      }
      setCropping({ format: key, src: objectUrl(file), wrongRatio: size });
      return;
    }
    const problem = backgroundProblem(key, width, height);
    if (problem) {
      setProblems(prev => ({ ...prev, [key]: problem }));
      return;
    }
    await uploadBackground(key, file, objectUrl(file));
  };

  /** "Recortar": crops the current background again, from its original image when there is one. */
  const recrop = (key: ShareArtFormat) => {
    const src =
      originals.current[key] ??
      (state[key].backgroundUrl
        ? sameOriginImageUrl(state[key].backgroundUrl!)
        : null);
    if (!src) return;
    setProblems(prev => ({ ...prev, [key]: undefined }));
    setCropping({ format: key, src, wrongRatio: null });
  };

  const handleCropped = async (file: File) => {
    if (!cropping) return;
    const { format: key, src } = cropping;
    setCropping(null);
    await uploadBackground(key, file, src);
  };

  const handleSamplePhoto = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    try {
      setSamplePhoto(await preparePhoto(file));
    } catch {
      toast({
        variant: 'destructive',
        title: 'Não foi possível abrir essa foto.',
      });
    }
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const { data } = await upsert({
        variables: {
          eventId,
          data: {
            story: formatInput({
              backgroundId: state.story.backgroundId,
              area: state.story.area,
            }),
            feed: formatInput({
              backgroundId: state.feed.backgroundId,
              area: state.feed.area,
            }),
          },
        },
      });
      // The page passes the saved config back as initialConfig, which resets the form.
      onSaved(data?.upsertShareArtConfig ?? null);
      toast({
        title: 'Arte salva',
        description: 'Os participantes já geram a arte com este fundo.',
      });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar',
        description: errorMessage(err),
      });
    }
  };

  return (
    <form id={FORM_ID} onSubmit={onSave} className="space-y-6">
      <AdminPageActions>
        {dirty && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setState(saved)}
            disabled={saving}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Descartar
          </Button>
        )}
        <Button
          type="submit"
          size="sm"
          form={FORM_ID}
          disabled={!dirty || saving || uploading !== null}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar arte
        </Button>
      </AdminPageActions>

      <Tabs
        value={format}
        onValueChange={value => setFormat(value as ShareArtFormat)}
      >
        <TabsList>
          {SHARE_ART_FORMAT_KEYS.map(key => (
            <TabsTrigger key={key} value={key}>
              {SHARE_ART_FORMATS[key].label} ({SHARE_ART_FORMATS[key].ratio})
              {state[key].backgroundId ? '' : ' · padrão'}
            </TabsTrigger>
          ))}
        </TabsList>

        {SHARE_ART_FORMAT_KEYS.map(key => {
          const spec = SHARE_ART_FORMATS[key];
          const value = state[key];
          const ratio = imageRatioOf(key);
          const previewHeight = Math.round(PREVIEW_WIDTH / ratio);
          return (
            <TabsContent key={key} value={key} className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {spec.label} ({spec.ratio})
                  </CardTitle>
                  <CardDescription>
                    Imagem de fundo {spec.ratio}, ao menos {spec.width}×
                    {spec.height} pixels. Sem fundo, o participante gera a arte
                    padrão do Hub neste formato.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploading !== null}
                      onClick={() => fileInputs.current[key]?.click()}
                    >
                      {uploading === key ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="mr-2 h-4 w-4" />
                      )}
                      {value.backgroundId
                        ? 'Trocar imagem de fundo'
                        : 'Escolher imagem de fundo'}
                    </Button>
                    {value.backgroundUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploading !== null}
                        onClick={() => recrop(key)}
                      >
                        <Crop className="mr-2 h-4 w-4" />
                        Recortar imagem de fundo
                      </Button>
                    )}
                    {value.backgroundId && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() =>
                          update(key, {
                            backgroundId: null,
                            backgroundUrl: null,
                          })
                        }
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Usar a arte padrão
                      </Button>
                    )}
                    <input
                      ref={el => {
                        fileInputs.current[key] = el;
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      aria-label={`Imagem de fundo ${spec.label}`}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        handleBackground(key, file);
                      }}
                    />
                  </div>
                  {problems[key] && (
                    <p role="alert" className="text-sm text-destructive">
                      {problems[key]}
                    </p>
                  )}

                  {value.backgroundUrl ? (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="space-y-5">
                        <p className="text-sm text-muted-foreground">
                          Arraste a área para posicionar a foto e use os
                          quadradinhos para redimensionar.
                        </p>
                        <ShareArtAreaEditor
                          backgroundUrl={value.backgroundUrl}
                          imageRatio={ratio}
                          area={value.area}
                          square={value.square}
                          photoUrl={samplePhoto}
                          onChange={area => update(key, { area })}
                          className={
                            key === 'story' ? 'max-w-[400px]' : 'max-w-[520px]'
                          }
                        />

                        <div className="max-w-[520px] space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`radius-${key}`}>
                              Arredondamento
                            </Label>
                            <span className="text-xs text-muted-foreground">
                              {Math.round(value.area.radius * 100)}%
                            </span>
                          </div>
                          <Slider
                            id={`radius-${key}`}
                            thumbLabel="Arredondamento da área"
                            min={0}
                            max={100}
                            step={1}
                            value={[Math.round(value.area.radius * 100)]}
                            onValueChange={([radius]) =>
                              update(key, {
                                area: { ...value.area, radius: radius / 100 },
                              })
                            }
                          />
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Canto reto</span>
                            <span>{value.square ? 'Círculo' : 'Cápsula'}</span>
                          </div>
                        </div>

                        <div className="flex max-w-[520px] items-center justify-between rounded-lg border p-3">
                          <div>
                            <Label htmlFor={`square-${key}`}>
                              Área quadrada
                            </Label>
                            <p className="text-xs text-muted-foreground">
                              Com o arredondamento no máximo, a foto vira um
                              círculo.
                            </p>
                          </div>
                          <Switch
                            id={`square-${key}`}
                            checked={value.square}
                            onCheckedChange={checked =>
                              update(key, {
                                square: checked,
                                area: checked
                                  ? squareArea(value.area, ratio)
                                  : value.area,
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-medium">
                          Prévia com foto de exemplo
                        </h3>
                        <CustomArtCanvas
                          backgroundUrl={value.backgroundUrl}
                          photoUrl={samplePhoto}
                          area={value.area}
                          width={PREVIEW_WIDTH}
                          height={previewHeight}
                          label={`Prévia da arte ${spec.label}`}
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() => sampleInput.current?.click()}
                        >
                          <UserRound className="mr-2 h-4 w-4" />
                          Testar com outra foto
                        </Button>
                        {samplePhoto !== SAMPLE_PHOTO_URL && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="w-full"
                            onClick={() => setSamplePhoto(SAMPLE_PHOTO_URL)}
                          >
                            Voltar à foto de exemplo
                          </Button>
                        )}
                        <p className="max-w-[220px] text-xs text-muted-foreground">
                          A foto de teste fica só no seu navegador. O
                          participante recorta a foto dele no formato desta
                          área.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed text-sm text-muted-foreground">
                      Sem imagem de fundo: os participantes geram a arte padrão
                      neste formato.
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      <input
        ref={sampleInput}
        type="file"
        accept="image/*"
        className="hidden"
        aria-label="Foto de teste"
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          handleSamplePhoto(file);
        }}
      />

      <ShareArtBackgroundCropDialog
        imageSrc={cropping?.src ?? null}
        format={cropping?.format ?? format}
        wrongRatio={cropping?.wrongRatio}
        onCancel={() => setCropping(null)}
        onCropped={handleCropped}
      />
    </form>
  );
}
