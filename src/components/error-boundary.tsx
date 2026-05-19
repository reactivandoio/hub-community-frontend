'use client';

import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Componente customizado de fallback */
  fallback?: ReactNode;
  /** Callback chamado quando um erro é capturado */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary para capturar erros em componentes filhos.
 *
 * @example
 * ```tsx
 * <ErrorBoundary onError={(error) => logError(error)}>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log do erro no console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Callback opcional para logging externo (analytics, Sentry, etc)
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Fallback customizado
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Fallback padrão
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
          <div className="flex max-w-md flex-col items-center text-center">
            <div className="mb-4 rounded-full bg-destructive/10 p-4">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>

            <h2 className="mb-2 text-xl font-semibold">
              Ops! Algo deu errado
            </h2>

            <p className="mb-6 text-muted-foreground">
              Ocorreu um erro inesperado. Você pode tentar novamente ou
              recarregar a página.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mb-6 w-full rounded-lg border bg-muted/50 p-4 text-left">
                <summary className="cursor-pointer text-sm font-medium">
                  Detalhes do erro (desenvolvimento)
                </summary>
                <pre className="mt-2 overflow-x-auto text-xs text-destructive">
                  {this.state.error.message}
                  {'\n\n'}
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={this.handleReset}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
              <Button onClick={this.handleReload}>
                Recarregar página
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * HOC para envolver componentes com Error Boundary
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WithErrorBoundaryWrapper(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <WrappedComponent {...props} />
      </ErrorBoundary>
    );
  };
}
