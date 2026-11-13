'use client';

import {
  CheckCircle2,
  Crop,
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  Share2,
  Trash2,
} from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Area } from 'react-easy-crop';
import { toast } from 'sonner';

import { CustomArtCanvas } from '@/components/share-art/custom-art-canvas';
import { ShareArtCropper } from '@/components/share-art/share-art-cropper';
import { ShareArtTemplate } from '@/components/share-art/share-art-template';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  SHARE_ART_FILTERS,
  SHARE_ART_FORMATS,
  SHARE_ART_LAYOUT,
  SHARE_ART_NAME_MAX,
  buildShareArtEvent,
  cleanShareArtName,
  offeredRoles,
  sameOriginImageUrl,
  shareArtFileName,
  shareArtHeadline,
  type ShareArtEventInput,
  type ShareArtFilter,
  type ShareArtFormat,
  type ShareArtRole,
} from '@/lib/share-art';
import {
  areaAspect,
  customFormatOf,
  imageRatioOf,
  type ShareArtConfig,
} from '@/lib/share-art-config';
import {
  exportCustomArt,
  loadArtImage,
  type ArtTextLayer,
} from '@/lib/share-art-custom';
import {
  cropPhoto,
  downloadBlob,
  exportNodeToPng,
  imageToDataUrl,
  preparePhoto,
  shareImage,
  uploadShareArt,
} from '@/lib/share-art-image';

const HUB_LOGO = '/images/logo-horizontal-raw.png';

interface ShareArtGeneratorProps {
  event: ShareArtEventInput & { slug: string };
  defaultName?: string;
  /** REA-43: the event's custom art; a format without it keeps the default art. */
  customConfig?: ShareArtConfig | null;
  /**
   * REA-45: false for someone who is not signed up (the organizer opened the art to everyone): the
   * default art then reads "Eu vou no" instead of "Me inscrevi no".
   */
  signedUp?: boolean;
}

/** Background of a custom format: its data URL, or 'failed' (→ default art for that format). */
type BackgroundState = Partial<Record<ShareArtFormat, string>>;

interface GeneratedArt {
  blob: Blob;
  fileName: string;
}

type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; progress: number }
  | { status: 'done'; url: string }
  | { status: 'error'; message: string };

function Step({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h2 className="flex items-center gap-2.5 font-semibold text-foreground">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
          {index}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={selected ? 'default' : 'outline'}
      className="w-full rounded-full"
      aria-pressed={selected}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

export function ShareArtGenerator({
  event,
  defaultName = '',
  customConfig = null,
  signedUp = true,
}: ShareArtGeneratorProps) {
  const artEvent = useMemo(
    () => ({
      ...buildShareArtEvent(event),
      headline: shareArtHeadline(signedUp),
    }),
    [event, signedUp]
  );

  const [format, setFormat] = useState<ShareArtFormat>('story');
  const [pickedRole, setRole] = useState<ShareArtRole>('Participante');
  // REA-49: only the roles the organizer offers, in the usual order; a single one is picked alone
  // and its step is not asked.
  const roles = useMemo(
    () => offeredRoles(customConfig?.roles),
    [customConfig?.roles]
  );
  const role = roles.includes(pickedRole) ? pickedRole : roles[0];
  const asksRole = roles.length > 1;
  const [name, setName] = useState(() => cleanShareArtName(defaultName));
  const [filter, setFilter] = useState<ShareArtFilter>('destaque');

  // Photo pipeline: picked file → downscaled `source` → crop area (per format) → filtered `photoUrl`.
  const [source, setSource] = useState<string | null>(null);
  const [crop, setCrop] = useState<{
    area: Area;
    format: ShareArtFormat;
  } | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isPreparingPhoto, setIsPreparingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [generated, setGenerated] = useState<GeneratedArt | null>(null);
  const [upload, setUpload] = useState<UploadState>({ status: 'idle' });

  const templateRef = useRef<HTMLDivElement>(null);
  const previewBoxRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);

  const layout = SHARE_ART_LAYOUT[format];

  // REA-43: custom art of this format (organizer's background + photo area), once its background
  // is loaded as a data URL (canvas export needs same-origin pixels). Until then, or if it fails,
  // the default template is used.
  const [backgrounds, setBackgrounds] = useState<BackgroundState>({});
  const storyBackground = customFormatOf(customConfig, 'story')?.background;
  const feedBackground = customFormatOf(customConfig, 'feed')?.background;
  useEffect(() => {
    let cancelled = false;
    (
      [
        ['story', storyBackground],
        ['feed', feedBackground],
      ] as const
    ).forEach(([key, url]) => {
      if (!url) return;
      imageToDataUrl(sameOriginImageUrl(url)).then(dataUrl => {
        if (cancelled) return;
        if (!dataUrl) console.warn('Arte do evento: fundo indisponível', key);
        setBackgrounds(prev => ({ ...prev, [key]: dataUrl ?? 'failed' }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [storyBackground, feedBackground]);

  const customFormat = customFormatOf(customConfig, format);
  const customBackground = backgrounds[format];
  const custom =
    customFormat && customBackground && customBackground !== 'failed'
      ? {
          area: customFormat.photo_area,
          background: customBackground,
          nameText: customFormat.name_text ?? null,
          roleText: customFormat.role_text ?? null,
        }
      : null;
  // REA-47: the name the person typed and the role they picked, where the organizer placed them.
  const customTexts: ArtTextLayer[] = custom
    ? [
        ...(custom.nameText ? [{ text: name, style: custom.nameText }] : []),
        ...(custom.roleText ? [{ text: role, style: custom.roleText }] : []),
      ]
    : [];
  const customPending = Boolean(customFormat) && !customBackground;
  // The crop follows the configured area even before the background loads (a failed background
  // falls back to the default frame, which covers any ratio).
  const photoAspect = customFormat
    ? areaAspect(customFormat.photo_area, imageRatioOf(format))
    : layout.photo.width / layout.photo.height;

  // Event cover and Hub logo as data URLs, so html-to-image can embed them.
  useEffect(() => {
    let cancelled = false;
    imageToDataUrl(HUB_LOGO).then(url => !cancelled && setLogoUrl(url));
    if (artEvent.coverUrl) {
      imageToDataUrl(sameOriginImageUrl(artEvent.coverUrl)).then(
        url => !cancelled && setCoverUrl(url)
      );
    }
    return () => {
      cancelled = true;
    };
  }, [artEvent.coverUrl]);

  // Re-crop + filter whenever the inputs change.
  useEffect(() => {
    if (!source || !crop) {
      setPhotoUrl(null);
      return;
    }
    let cancelled = false;
    cropPhoto(source, crop.area, SHARE_ART_FILTERS[filter].css)
      .then(url => !cancelled && setPhotoUrl(url))
      .catch(
        () => !cancelled && toast.error('Não foi possível recortar a foto.')
      );
    return () => {
      cancelled = true;
    };
  }, [source, crop, filter]);

  // The photo frame has a different ratio per format: ask for a new crop when it changes.
  useEffect(() => {
    if (source && crop && crop.format !== format) setIsCropping(true);
  }, [format, source, crop]);

  // Any change makes the last export stale (and ignores its upload, if still running).
  const uploadRun = useRef(0);
  useEffect(() => {
    uploadRun.current += 1;
    setGenerated(null);
    setUpload({ status: 'idle' });
  }, [format, role, name, photoUrl, coverUrl, logoUrl, custom?.background]);

  // Fit the fixed-size template into the preview column.
  useEffect(() => {
    const box = previewBoxRef.current;
    if (!box) return;
    const update = () =>
      setPreviewScale(Math.min(1.25, box.clientWidth / layout.width));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(box);
    return () => observer.disconnect();
  }, [layout.width]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Escolha um arquivo de imagem.');
      return;
    }
    setIsPreparingPhoto(true);
    try {
      setSource(await preparePhoto(file));
      setCrop(null);
      setIsCropping(true);
    } catch {
      toast.error('Não foi possível abrir essa foto. Tente outra.');
    } finally {
      setIsPreparingPhoto(false);
    }
  };

  const removePhoto = () => {
    setSource(null);
    setCrop(null);
    setIsCropping(false);
  };

  const startUpload = useCallback((art: GeneratedArt) => {
    const run = uploadRun.current;
    const update = (state: UploadState) =>
      run === uploadRun.current && setUpload(state);
    update({ status: 'uploading', progress: 0 });
    uploadShareArt(art.blob, art.fileName, progress =>
      update({ status: 'uploading', progress })
    )
      .then(url => update({ status: 'done', url }))
      .catch((err: Error) => update({ status: 'error', message: err.message }));
  }, []);

  const handleDownload = async () => {
    if (generated) {
      downloadBlob(generated.blob, generated.fileName);
      return;
    }
    if (!custom && !templateRef.current) return;
    setIsExporting(true);
    try {
      const output = SHARE_ART_FORMATS[format];
      const blob = custom
        ? await exportCustomArt({
            width: output.width,
            height: output.height,
            background: await loadArtImage(custom.background),
            photo: photoUrl ? await loadArtImage(photoUrl) : null,
            area: custom.area,
            texts: customTexts,
          })
        : await exportNodeToPng(templateRef.current!, layout, output);
      const art = {
        blob,
        fileName: shareArtFileName(
          event.slug,
          custom ? 'eu-vou' : role,
          format
        ),
      };
      setGenerated(art);
      downloadBlob(art.blob, art.fileName);
      startUpload(art);
    } catch (err) {
      console.error('Erro ao gerar a arte:', err);
      toast.error('Não foi possível gerar a arte. Tente novamente.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleShare = async () => {
    if (!generated) return;
    try {
      const shared = await shareImage(generated.blob, generated.fileName);
      if (!shared)
        toast.info(
          'Seu navegador não compartilha imagens. Use o botão de baixar.'
        );
    } catch (err) {
      console.warn('Erro ao compartilhar:', err);
      toast.error('Não foi possível compartilhar.');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
      {/* Controls */}
      <div className="space-y-5 lg:col-span-6">
        <Step index={1} title="Sua foto">
          {source && isCropping ? (
            <>
              <p className="text-sm text-muted-foreground">
                Arraste para posicionar e use o zoom para aproximar.
              </p>
              <ShareArtCropper
                key={format}
                imageSrc={source}
                aspect={photoAspect}
                onConfirm={area => {
                  setCrop({ area, format });
                  setIsCropping(false);
                }}
                onCancel={() => (crop ? setIsCropping(false) : removePhoto())}
              />
            </>
          ) : source ? (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-sm text-primary">
                <CheckCircle2 className="h-4 w-4" />
                Foto posicionada. Veja a prévia ao lado.
              </p>
              <div className="space-y-2">
                <Label>Filtro</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(SHARE_ART_FILTERS) as ShareArtFilter[]).map(
                    key => (
                      <OptionButton
                        key={key}
                        selected={filter === key}
                        onClick={() => setFilter(key)}
                      >
                        {SHARE_ART_FILTERS[key].label}
                      </OptionButton>
                    )
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setIsCropping(true)}
                >
                  <Crop className="mr-2 h-4 w-4" />
                  Ajustar corte
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full text-destructive"
                  onClick={removePhoto}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Trocar foto
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPreparingPhoto}
              className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-sm text-muted-foreground transition-colors hover:bg-primary/10 disabled:opacity-60"
            >
              {isPreparingPhoto ? (
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              ) : (
                <ImagePlus className="h-8 w-8 text-primary" />
              )}
              <span className="font-semibold text-foreground">
                Escolher foto
              </span>
              <span className="text-xs">PNG ou JPG</span>
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFile}
          />
        </Step>

        <Step index={2} title="Formato">
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(SHARE_ART_FORMATS) as ShareArtFormat[]).map(key => (
              <OptionButton
                key={key}
                selected={format === key}
                onClick={() => setFormat(key)}
              >
                {SHARE_ART_FORMATS[key].label} ({SHARE_ART_FORMATS[key].ratio})
              </OptionButton>
            ))}
          </div>
        </Step>

        {custom && (
          <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
            Este formato usa a arte do evento: sua foto entra no espaço que a
            organização preparou.
          </p>
        )}
        {/* The role and the name: on the default art always; on the organizer's art (REA-47) when
            it placed them, drawn where it chose. */}
        {asksRole && (!custom || custom.roleText) && (
          <Step index={3} title="Seu papel no evento">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {roles.map(r => (
                <OptionButton
                  key={r}
                  selected={role === r}
                  onClick={() => setRole(r)}
                >
                  {r}
                </OptionButton>
              ))}
            </div>
          </Step>
        )}
        {(!custom || custom.nameText) && (
          <Step
            index={asksRole && (!custom || custom.roleText) ? 4 : 3}
            title="Seu nome"
          >
            <Input
              value={name}
              onChange={e => setName(cleanShareArtName(e.target.value))}
              maxLength={SHARE_ART_NAME_MAX}
              placeholder="Como você quer aparecer"
              aria-label="Seu nome"
            />
            <p className="text-xs text-muted-foreground">
              {name.length}/{SHARE_ART_NAME_MAX} caracteres
            </p>
          </Step>
        )}
      </div>

      {/* Preview + actions */}
      <div className="space-y-4 lg:col-span-6">
        <div className="lg:sticky lg:top-24 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold text-foreground">Prévia</h2>
            <span className="text-xs text-muted-foreground">
              PNG {SHARE_ART_FORMATS[format].width}×
              {SHARE_ART_FORMATS[format].height}
            </span>
          </div>

          <div ref={previewBoxRef} className="mx-auto w-full max-w-[450px]">
            <div
              className="relative mx-auto overflow-hidden rounded-xl shadow-xl"
              style={{
                width: layout.width * previewScale,
                height: layout.height * previewScale,
              }}
            >
              {custom ? (
                <CustomArtCanvas
                  backgroundUrl={custom.background}
                  photoUrl={photoUrl}
                  area={custom.area}
                  texts={customTexts}
                  width={layout.width * previewScale}
                  height={layout.height * previewScale}
                  className="rounded-none shadow-none"
                  label="Prévia da sua arte"
                />
              ) : customPending ? (
                <div className="h-full w-full animate-pulse bg-muted" />
              ) : (
                <div
                  className="origin-top-left"
                  style={{ transform: `scale(${previewScale})` }}
                >
                  <ShareArtTemplate
                    ref={templateRef}
                    format={format}
                    event={artEvent}
                    role={role}
                    name={name}
                    photoUrl={photoUrl}
                    coverUrl={coverUrl}
                    logoUrl={logoUrl}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="mx-auto w-full max-w-[450px] space-y-3">
            <Button
              size="lg"
              className="w-full rounded-full font-semibold"
              disabled={isExporting || isCropping || customPending}
              onClick={handleDownload}
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {isExporting
                ? 'Gerando arte…'
                : generated
                  ? 'Baixar de novo'
                  : 'Baixar arte'}
            </Button>

            {generated && (
              <Button
                size="lg"
                variant="outline"
                className="w-full rounded-full"
                onClick={handleShare}
              >
                <Share2 className="mr-2 h-4 w-4" />
                Compartilhar
              </Button>
            )}

            {upload.status === 'uploading' && (
              <div className="space-y-1.5">
                <Progress value={upload.progress} />
                <p className="text-xs text-muted-foreground">
                  Salvando cópia no Hub Community… {upload.progress}%
                </p>
              </div>
            )}
            {upload.status === 'done' && (
              <a
                href={upload.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 text-sm text-primary hover:underline"
              >
                Cópia salva — abrir link público
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            {upload.status === 'error' && (
              <p className="text-center text-xs text-destructive">
                Não foi possível salvar a cópia online ({upload.message}). Sua
                arte foi baixada normalmente.
              </p>
            )}

            <p className="text-center text-xs text-muted-foreground">
              Ao baixar, uma cópia da arte fica salva no Hub Community. Poste e
              marque a comunidade do evento!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
