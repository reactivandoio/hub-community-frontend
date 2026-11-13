'use client';

import { useMutation } from '@apollo/client';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
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
import {
  ShareArtAreaEditor,
  type EditorAreaKey,
} from '@/components/admin/share-art-area-editor';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  SHARE_ART_FONTS,
  SHARE_ART_FORMAT_KEYS,
  SHARE_ART_TEXT_SIZE_MAX,
  SHARE_ART_TEXT_SIZE_MIN,
  backgroundProblem,
  cropSourceProblem,
  customFormatOf,
  defaultPhotoArea,
  defaultTextArea,
  formatInput,
  imageRatioOf,
  isSquareArea,
  ratioMatches,
  squareArea,
  type ShareArtAlign,
  type ShareArtConfig,
  type ShareArtFont,
  type ShareArtPhotoArea,
  type ShareArtText,
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
  /** REA-47: null → that text is not on the art. */
  nameText: ShareArtText | null;
  roleText: ShareArtText | null;
}

type FormState = Record<ShareArtFormat, FormatState>;

type TextKind = 'name' | 'role';
const TEXT_FIELD: Record<TextKind, 'nameText' | 'roleText'> = {
  name: 'nameText',
  role: 'roleText',
};
const TEXT_LABEL: Record<TextKind, string> = { name: 'Nome', role: 'Papel' };

/** The sample name and role of the admin preview (the person types/picks them in the generator). */
const SAMPLE_NAME = 'Maria Silva';
const SAMPLE_ROLE = 'Participante';

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
      nameText: custom?.name_text ?? null,
      roleText: custom?.role_text ?? null,
    };
  });
  return state;
}

const formatOf = (value: FormatState) =>
  formatInput({
    backgroundId: value.backgroundId,
    area: value.area,
    nameText: value.nameText,
    roleText: value.roleText,
  });

/** What the save sends: the local blob URL and the "square" switch are editor state only. */
const savedShape = (state: FormState) =>
  JSON.stringify(SHARE_ART_FORMAT_KEYS.map(format => formatOf(state[format])));

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
  // REA-47: which area of each format is being edited (the photo, the name or the role).
  const [active, setActive] = useState<Record<ShareArtFormat, EditorAreaKey>>({
    story: 'photo',
    feed: 'photo',
  });
  const retired = new Set(initialConfig?.retired_formats ?? []);
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

  // REA-47: the sample texts of the editor and the preview.
  const samples: Record<TextKind, string> = {
    name: SAMPLE_NAME,
    role: SAMPLE_ROLE,
  };
  const textAreas = (value: FormatState) =>
    (['name', 'role'] as TextKind[]).flatMap(kind => {
      const style = value[TEXT_FIELD[kind]];
      return style
        ? [
            {
              key: kind,
              label: `Área do ${kind === 'name' ? 'nome' : 'papel'}`,
              style,
              preview: samples[kind],
            },
          ]
        : [];
    });
  const previewTexts = (value: FormatState) =>
    textAreas(value).map(area => ({ text: area.preview, style: area.style }));

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
          // A first background starts with the default circle and, under it, the name and the
          // role (REA-47); a new one keeps the areas.
          ...(prev[key].backgroundId
            ? {}
            : {
                area: defaultPhotoArea(key),
                square: true,
                nameText: defaultTextArea(key, 'name'),
                roleText: defaultTextArea(key, 'role'),
              }),
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
            story: formatOf(state.story),
            feed: formatOf(state.feed),
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
                  {retired.has(key) && !value.backgroundUrl && (
                    <p
                      className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground"
                      data-testid={`retired-${key}`}
                    >
                      O fundo salvo antes estava em outra proporção e deixou de
                      valer: o {spec.label} agora é {spec.ratio} ({spec.width}×
                      {spec.height}). Envie um fundo novo; até lá, os
                      participantes geram a arte padrão neste formato.
                    </p>
                  )}

                  {value.backgroundUrl ? (
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
                      <div className="space-y-5">
                        <div
                          role="radiogroup"
                          aria-label={`O que editar no ${spec.label}`}
                          className="flex flex-wrap gap-2"
                        >
                          {(['photo', 'name', 'role'] as EditorAreaKey[]).map(
                            item => (
                              <Button
                                key={item}
                                type="button"
                                size="sm"
                                role="radio"
                                aria-checked={active[key] === item}
                                variant={
                                  active[key] === item ? 'default' : 'outline'
                                }
                                onClick={() =>
                                  setActive(prev => ({ ...prev, [key]: item }))
                                }
                              >
                                {item === 'photo'
                                  ? 'Foto'
                                  : TEXT_LABEL[item as TextKind]}
                              </Button>
                            )
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Arraste as áreas para posicionar a foto, o nome e o
                          papel, e use os quadradinhos da área escolhida para
                          redimensionar.
                        </p>
                        <ShareArtAreaEditor
                          backgroundUrl={value.backgroundUrl}
                          imageRatio={ratio}
                          area={value.area}
                          square={value.square}
                          photoUrl={samplePhoto}
                          onChange={area => update(key, { area })}
                          texts={textAreas(value)}
                          onTextChange={(kind, style) =>
                            update(key, { [TEXT_FIELD[kind]]: style })
                          }
                          active={active[key]}
                          onSelect={item =>
                            setActive(prev => ({ ...prev, [key]: item }))
                          }
                          className={
                            key === 'story' ? 'max-w-[400px]' : 'max-w-[440px]'
                          }
                        />

                        {active[key] === 'photo' ? (
                          <>
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
                                    area: {
                                      ...value.area,
                                      radius: radius / 100,
                                    },
                                  })
                                }
                              />
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Canto reto</span>
                                <span>
                                  {value.square ? 'Círculo' : 'Cápsula'}
                                </span>
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
                          </>
                        ) : (
                          <TextControls
                            formatLabel={spec.label}
                            kind={active[key] as TextKind}
                            value={value[TEXT_FIELD[active[key] as TextKind]]}
                            onChange={text =>
                              update(key, {
                                [TEXT_FIELD[active[key] as TextKind]]: text,
                              })
                            }
                            onEnable={() =>
                              update(key, {
                                [TEXT_FIELD[active[key] as TextKind]]:
                                  defaultTextArea(key, active[key] as TextKind),
                              })
                            }
                          />
                        )}
                      </div>

                      <div className="space-y-3">
                        <h3 className="text-sm font-medium">
                          Prévia com foto de exemplo
                        </h3>
                        <CustomArtCanvas
                          backgroundUrl={value.backgroundUrl}
                          photoUrl={samplePhoto}
                          area={value.area}
                          texts={previewTexts(value)}
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

const ALIGN_OPTIONS: {
  value: ShareArtAlign;
  label: string;
  Icon: typeof AlignLeft;
}[] = [
  { value: 'left', label: 'Alinhar à esquerda', Icon: AlignLeft },
  { value: 'center', label: 'Centralizar', Icon: AlignCenter },
  { value: 'right', label: 'Alinhar à direita', Icon: AlignRight },
];

/** REA-47: show/hide, font, size, color and alignment of the name or the role. */
function TextControls({
  formatLabel,
  kind,
  value,
  onChange,
  onEnable,
}: {
  formatLabel: string;
  kind: TextKind;
  value: ShareArtText | null;
  onChange: (text: ShareArtText | null) => void;
  onEnable: () => void;
}) {
  const what = kind === 'name' ? 'o nome' : 'o papel';
  const id = `${formatLabel}-${kind}`.toLowerCase();
  return (
    <div className="max-w-[520px] space-y-4 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor={`show-${id}`}>Mostrar {what} na arte</Label>
          <p className="text-xs text-muted-foreground">
            {kind === 'name'
              ? 'O nome que a pessoa digita no gerador (quem está logado já vem preenchido).'
              : 'O papel que a pessoa escolhe no gerador: Participante, Líder, Mentor, Voluntário, Palestrante ou Organizador.'}
          </p>
        </div>
        <Switch
          id={`show-${id}`}
          checked={Boolean(value)}
          onCheckedChange={checked => (checked ? onEnable() : onChange(null))}
        />
      </div>
      {value && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor={`font-${id}`}>Fonte</Label>
            <Select
              value={value.font}
              onValueChange={font =>
                onChange({ ...value, font: font as ShareArtFont })
              }
            >
              <SelectTrigger id={`font-${id}`} aria-label={`Fonte d${what}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHARE_ART_FONTS.map(font => (
                  <SelectItem key={font.key} value={font.key}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor={`size-${id}`}>Tamanho</Label>
              <span className="text-xs text-muted-foreground">
                {Math.round(value.size * 1080)} px na arte
              </span>
            </div>
            <Slider
              id={`size-${id}`}
              thumbLabel={`Tamanho d${what}`}
              min={SHARE_ART_TEXT_SIZE_MIN * 1000}
              max={SHARE_ART_TEXT_SIZE_MAX * 1000}
              step={1}
              value={[Math.round(value.size * 1000)]}
              onValueChange={([size]) =>
                onChange({ ...value, size: size / 1000 })
              }
            />
            <p className="text-xs text-muted-foreground">
              Um texto longo diminui sozinho para caber na área.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label htmlFor={`color-${id}`}>Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  id={`color-${id}`}
                  type="color"
                  aria-label={`Cor d${what}`}
                  value={value.color}
                  onChange={e => onChange({ ...value, color: e.target.value })}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent p-0.5"
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {value.color}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Alinhamento</span>
              <div
                role="radiogroup"
                aria-label={`Alinhamento d${what}`}
                className="flex gap-1"
              >
                {ALIGN_OPTIONS.map(({ value: align, label, Icon }) => (
                  <Button
                    key={align}
                    type="button"
                    size="icon"
                    role="radio"
                    aria-checked={value.align === align}
                    aria-label={label}
                    variant={value.align === align ? 'default' : 'outline'}
                    className="h-9 w-9"
                    onClick={() => onChange({ ...value, align })}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
