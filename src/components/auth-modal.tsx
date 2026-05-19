'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { ApolloError } from '@apollo/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/auth-context';
import {
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ResetPasswordFormValues,
  type SignInFormValues,
  type SignUpFormValues,
} from '@/lib/schemas';
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, User } from 'lucide-react';

const ERROR_MESSAGES: Record<string, string> = {
  'Email or Username are already taken': 'Email ou username já está em uso.',
  'Invalid identifier or password': 'Email/username ou senha inválidos.',
  'Error signing in: Invalid identifier or password': 'Email/username ou senha inválidos.',
  'Your account email is not confirmed': 'Confirme seu email antes de fazer login.',
  'Error signing in: Your account email is not confirmed': 'Confirme seu email antes de fazer login.',
  'Too many attempts': 'Muitas tentativas. Aguarde alguns minutos.',
  'Too many requests': 'Muitas tentativas. Aguarde alguns minutos.',
  'User not found': 'Usuário não encontrado.',
  'Invalid email': 'Email inválido.',
  'Invalid password': 'Senha incorreta.',
  'Invalid credentials': 'Credenciais inválidas.',
  'Email already taken': 'Este email já está em uso.',
  'Username already taken': 'Este username já está em uso.',
  'Email not found': 'Email não encontrado.',
  'Error on try POST': 'Erro ao processar. Tente novamente.',
};

function getErrorMessage(error: unknown, fallback: string): string {
  let message = '';

  if (error instanceof ApolloError) {
    message = error.graphQLErrors?.[0]?.message || '';
    if (!message && error.networkError) {
      return 'Erro de conexão. Verifique sua internet.';
    }
  } else if (error instanceof Error) {
    message = error.message;
  }

  if (!message) return fallback;

  if (ERROR_MESSAGES[message]) {
    return ERROR_MESSAGES[message];
  }

  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (message.includes(key)) {
      return value;
    }
  }

  return fallback;
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectUrl?: string | null;
}

export function AuthModal({ isOpen, onClose, redirectUrl }: AuthModalProps) {
  const { signIn, signUp, forwardPassword, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('signin');

  // Password visibility
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // Email confirmation
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');

  // Sign In Form
  const signInForm = useForm<SignInFormValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { identifier: '', password: '' },
  });

  // Sign Up Form
  const signUpForm = useForm<SignUpFormValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { email: '', name: '', password: '', username: '', phone: '' },
  });

  // Reset Password Form
  const resetForm = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { email: '' },
  });

  const handleSignIn = async (data: SignInFormValues) => {
    try {
      await signIn(data);
      toast.success('Bem-vindo(a) de volta!');
      setTimeout(() => {
        onClose();
        signInForm.reset();
        if (redirectUrl) {
          router.push(redirectUrl);
        }
      }, 1000);
    } catch (error) {
      const message = getErrorMessage(error, 'Erro ao fazer login. Verifique suas credenciais.');
      toast.error(message);
      console.error('Sign in error:', error);
    }
  };

  const handleSignUp = async (data: SignUpFormValues) => {
    try {
      await signUp(data);
      setConfirmationEmail(data.email);
      setShowEmailConfirmation(true);
      toast.success('Conta criada com sucesso!');
    } catch (error) {
      const message = getErrorMessage(error, 'Erro ao criar conta. Tente novamente.');
      toast.error(message);
      console.error('Sign up error:', error);
    }
  };

  const handlePasswordReset = async (data: ResetPasswordFormValues) => {
    try {
      await forwardPassword(data.email);
      toast.success('Email de recuperação enviado!');
      setTimeout(() => {
        resetForm.reset();
      }, 2000);
    } catch (error) {
      const message = getErrorMessage(error, 'Erro ao enviar email de recuperação.');
      toast.error(message);
      console.error('Password reset error:', error);
    }
  };

  const handleClose = () => {
    setActiveTab('signin');
    signInForm.reset();
    signUpForm.reset();
    resetForm.reset();
    setShowEmailConfirmation(false);
    setConfirmationEmail('');
    setShowSignInPassword(false);
    setShowSignUpPassword(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Entrar na sua conta</DialogTitle>
          <DialogDescription>
            Faça login, cadastre-se ou recupere sua senha
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="signin">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            <TabsTrigger value="reset">Recuperar</TabsTrigger>
          </TabsList>

          {/* Email Confirmation Message */}
          {showEmailConfirmation && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex">
                <div className="flex-shrink-0">
                  <Mail className="h-5 w-5 text-green-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-green-800">
                    Email de confirmação enviado!
                  </h3>
                  <div className="mt-2 text-sm text-green-700">
                    <p>
                      Enviamos um email para <strong>{confirmationEmail}</strong>{' '}
                      com um link para confirmar sua conta. Verifique sua caixa
                      de entrada e clique no link para ativar sua conta.
                    </p>
                    <p className="mt-2">
                      Não esqueça de verificar também a pasta de spam/junk.
                    </p>
                  </div>
                  <div className="mt-4">
                    <Button
                      onClick={() => {
                        setShowEmailConfirmation(false);
                        setActiveTab('signin');
                        signUpForm.reset();
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Entendi
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sign In Tab */}
          <TabsContent value="signin" className="space-y-4">
            <Form {...signInForm}>
              <form onSubmit={signInForm.handleSubmit(handleSignIn)} className="space-y-4">
                <FormField
                  control={signInForm.control}
                  name="identifier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email ou Username</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="seu@email.com ou username"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signInForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type={showSignInPassword ? 'text' : 'password'}
                            placeholder="Digite sua senha"
                            className="pl-10 pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignInPassword(!showSignInPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label={showSignInPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          >
                            {showSignInPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Entrando...
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>

          {/* Sign Up Tab */}
          <TabsContent value="signup" className="space-y-4">
            <Form {...signUpForm}>
              <form onSubmit={signUpForm.handleSubmit(handleSignUp)} className="space-y-4">
                <FormField
                  control={signUpForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input placeholder="Seu nome completo" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signUpForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <User className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            placeholder="seu_username"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signUpForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="seu@email.com"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signUpForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefone WhatsApp (opcional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="tel"
                            placeholder="+55 11 98765-4321"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={signUpForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type={showSignUpPassword ? 'text' : 'password'}
                            placeholder="Digite uma senha forte"
                            className="pl-10 pr-10"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                            aria-label={showSignUpPassword ? 'Ocultar senha' : 'Mostrar senha'}
                          >
                            {showSignUpPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    'Criar Conta'
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>

          {/* Password Reset Tab */}
          <TabsContent value="reset" className="space-y-4">
            <Form {...resetForm}>
              <form onSubmit={resetForm.handleSubmit(handlePasswordReset)} className="space-y-4">
                <FormField
                  control={resetForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                          <Input
                            type="email"
                            placeholder="seu@email.com"
                            className="pl-10"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar Email de Recuperação'
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
