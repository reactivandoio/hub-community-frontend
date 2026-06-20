'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@apollo/client';
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
  CheckCircle2,
  Loader2,
  AlertCircle,
  ClipboardCheck,
  LogIn,
} from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { CREATE_ATTENDANCE, GET_EVENT_BY_SLUG_OR_ID } from '@/lib/queries';
import { CreateAttendanceResponse } from '@/lib/types';
import { AuthModal } from '@/components/auth-modal';
import Link from 'next/link';

// CPF mask: 999.999.999-99
function maskCpf(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 11);
  if (clean.length <= 3) return clean;
  if (clean.length <= 6) return `${clean.slice(0, 3)}.${clean.slice(3)}`;
  if (clean.length <= 9)
    return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
  return `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9)}`;
}

// Phone mask: (99) 99999-9999
function maskPhone(value: string): string {
  const clean = value.replace(/\D/g, '').slice(0, 11);
  if (clean.length <= 2) return clean.length ? `(${clean}` : '';
  if (clean.length <= 7) return `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
  return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
}

// Validate CPF has 11 digits
function isValidCpf(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, '');
  return clean.length === 11;
}

// Validate age >= 18
function isAtLeast18(dateStr: string): boolean {
  if (!dateStr) return false;
  const birth = new Date(dateStr);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birth.getDate())
  ) {
    age--;
  }
  return age >= 18;
}

export default function AttendanceFormPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const { user, isAuthenticated } = useAuth();

  const { data: eventData, loading: eventLoading } = useQuery(
    GET_EVENT_BY_SLUG_OR_ID,
    {
      variables: { slugOrId: slug },
      skip: !slug,
    }
  );

  const [createAttendance, { loading: submitting }] =
    useMutation<CreateAttendanceResponse>(CREATE_ATTENDANCE);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    cpf: '',
    email: '',
    date_of_birth: '',
  });

  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill from logged-in user
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({
        ...prev,
        name: user.name || prev.name,
        email: user.email || prev.email,
        phone: user.phone ? maskPhone(user.phone) : prev.phone,
      }));
    }
  }, [user]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;

    if (id === 'cpf') {
      setFormData((prev) => ({ ...prev, cpf: maskCpf(value) }));
    } else if (id === 'phone') {
      setFormData((prev) => ({ ...prev, phone: maskPhone(value) }));
    } else {
      setFormData((prev) => ({ ...prev, [id]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!formData.name.trim()) {
      setError('Nome completo é obrigatório.');
      return;
    }

    if (!isValidCpf(formData.cpf)) {
      setError('CPF inválido. Digite os 11 dígitos.');
      return;
    }

    if (!formData.email.trim()) {
      setError('E-mail é obrigatório.');
      return;
    }

    if (!formData.date_of_birth) {
      setError('Data de nascimento é obrigatória.');
      return;
    }

    if (!isAtLeast18(formData.date_of_birth)) {
      setError('É necessário ter pelo menos 18 anos para assinar a presença.');
      return;
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Telefone inválido. Digite o número completo com DDD.');
      return;
    }

    const eventDocId = eventData?.eventBySlugOrId?.documentId;
    if (!eventDocId) {
      setError('Evento não encontrado.');
      return;
    }

    try {
      const { data } = await createAttendance({
        variables: {
          eventDocumentId: eventDocId,
          cpf: formData.cpf.replace(/\D/g, ''),
          date_of_birth: formData.date_of_birth,
          phone: cleanPhone,
          name: formData.name.trim(),
        },
      });

      if (data?.createAttendance?.success) {
        setSuccess(true);
      } else {
        setError(
          data?.createAttendance?.message || 'Erro ao registrar presença.'
        );
      }
    } catch (err: any) {
      setError(
        err.message || 'Ocorreu um erro inesperado. Tente novamente.'
      );
    }
  };

  // Loading event
  if (eventLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Event not found
  if (!eventData?.eventBySlugOrId) {
    return (
      <div className="container max-w-2xl mx-auto py-20 px-4 min-h-[80vh] flex items-center justify-center">
        <Card className="w-full text-center shadow-lg border-destructive/20">
          <CardContent className="pt-10 pb-8 flex flex-col items-center">
            <AlertCircle className="w-16 h-16 text-destructive mb-6" />
            <h2 className="text-2xl font-bold mb-3">Evento não encontrado</h2>
            <p className="text-muted-foreground mb-6">
              Verifique o link e tente novamente.
            </p>
            <Link href="/">
              <Button variant="outline" className="rounded-full">
                Voltar ao início
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Not authenticated — show login modal on top of the page
  if (!isAuthenticated) {
    return (
      <div className="container max-w-2xl mx-auto py-20 px-4 min-h-[80vh] flex items-center justify-center">
        <AuthModal
          isOpen={true}
          onClose={() => {}}
        />
        <Card className="w-full text-center shadow-lg border-primary/10">
          <CardContent className="pt-10 pb-8 flex flex-col items-center">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
              <LogIn className="w-10 h-10 text-primary" />
            </div>
            <h2 className="text-2xl font-bold mb-3">Login Necessário</h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              Você precisa estar logado para assinar a lista de presença do
              evento{' '}
              <span className="font-semibold text-foreground">
                {eventData.eventBySlugOrId.title}
              </span>
              .
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success
  if (success) {
    return (
      <div className="container max-w-2xl mx-auto py-20 px-4 min-h-[80vh] flex items-center justify-center">
        <Card className="w-full text-center shadow-lg border-primary/10">
          <CardContent className="pt-10 pb-8 flex flex-col items-center">
            <CheckCircle2 className="w-20 h-20 text-green-500 mb-6" />
            <h2 className="text-3xl font-bold mb-4">Presença Registrada!</h2>
            <p className="text-muted-foreground mb-8 text-lg max-w-md">
              Sua presença no evento{' '}
              <span className="font-semibold text-foreground">
                {eventData.eventBySlugOrId.title}
              </span>{' '}
              foi registrada com sucesso.
            </p>
            <Link href={`/events/${slug}`}>
              <Button size="lg" className="rounded-full">
                Voltar para o evento
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const eventTitle = eventData.eventBySlugOrId.title;

  return (
    <div className="container max-w-2xl mx-auto py-12 px-4 min-h-[80vh] flex items-center justify-center">
      <Card className="w-full shadow-lg border-primary/10">
        <CardHeader className="text-center space-y-2 pb-8">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-2">
            <ClipboardCheck className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold tracking-tight">
            Lista de Presença
          </CardTitle>
          <CardDescription className="text-base text-muted-foreground">
            Confirme seus dados para registrar sua presença no evento{' '}
            <span className="font-semibold text-foreground">{eventTitle}</span>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-destructive/15 text-destructive p-4 rounded-md flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-semibold">
                  Nome Completo
                </Label>
                <Input
                  id="name"
                  placeholder="Ex: João da Silva"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  disabled={submitting}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpf" className="text-sm font-semibold">
                  CPF
                </Label>
                <Input
                  id="cpf"
                  placeholder="000.000.000-00"
                  required
                  value={formData.cpf}
                  onChange={handleChange}
                  disabled={submitting}
                  className="h-12"
                  maxLength={14}
                  inputMode="numeric"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-semibold">
                  E-mail
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="exemplo@email.com"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  disabled={submitting}
                  className="h-12"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-semibold">
                  Telefone
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  required
                  value={formData.phone}
                  onChange={handleChange}
                  disabled={submitting}
                  className="h-12"
                  maxLength={15}
                  inputMode="tel"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="date_of_birth"
                  className="text-sm font-semibold"
                >
                  Data de Nascimento
                </Label>
                <Input
                  id="date_of_birth"
                  type="date"
                  required
                  value={formData.date_of_birth}
                  onChange={handleChange}
                  disabled={submitting}
                  className="h-12"
                />
                <p className="text-xs text-muted-foreground">
                  É necessário ter pelo menos 18 anos.
                </p>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-lg font-medium"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Registrando...
                </>
              ) : (
                'Assinar Presença'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
