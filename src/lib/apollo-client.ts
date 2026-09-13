import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { isTokenExpired } from './jwt';

// Lazy initialization to avoid creating the client during server-side module evaluation
let client: ApolloClient<any> | null = null;

function createApolloClient() {
  // Configuração da URL do BFF GraphQL
  const httpUrl = process.env.NEXT_PUBLIC_GRAPHQL_URL || 'http://localhost:4000/graphql';

  const httpLink = createHttpLink({
    uri: httpUrl,
  });

  // Middleware para adicionar headers de autenticação
  const authLink = setContext((_, { headers }) => {
    // Get token from localStorage
    const token =
      typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

    // Validate token before using it
    if (token && isTokenExpired(token)) {
      // Clear expired token from storage
      if (typeof window !== 'undefined') {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        // Dispatch event to show logout modal
        window.dispatchEvent(new CustomEvent('auth:tokenExpired'));
      }
      // Don't include authorization header for expired tokens
      return {
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      };
    }

    return {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    };
  });

  // Error handling link
  const errorLink = onError(({ graphQLErrors, networkError }) => {
    if (process.env.NODE_ENV === 'development') {
      if (graphQLErrors) {
        graphQLErrors.forEach(({ message, path }) => {
          console.error(`[GraphQL error]: ${message} (path: ${path})`);
        });
      }
      if (networkError) {
        console.error(`[Network error]: ${networkError}`);
      }
    }
  });

  // Build the HTTP chain
  const httpChain = errorLink.concat(authLink.concat(httpLink));

  // Build the final link — with WS split on the client
  let link = httpChain;

  if (typeof window !== 'undefined') {
    // Convert HTTP URL to WS URL — BFF WS server listens on path '/'
    const wsUrl = httpUrl
      .replace(/^http/, 'ws')
      .replace(/\/graphql$/, '');

    // Lazy WS link — only creates connection when a subscription is used
    const wsLink = new GraphQLWsLink(
      createClient({
        url: wsUrl,
        connectionParams: () => {
          const token = localStorage.getItem('auth_token');
          return {
            authorization: token ? `Bearer ${token}` : '',
          };
        },
        // Retry reconnections with backoff, not infinite
        retryAttempts: 5,
        shouldRetry: () => true,
        lazy: true,
        on: {
          error: () => {
            // Silently handle WS errors — subscriptions will degrade gracefully
          },
        },
      })
    );

    // Split: subscriptions go via WS, everything else via HTTP
    link = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpChain
    );
  }

  // Criação do cliente Apollo
  return new ApolloClient({
    link,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            communities: {
              merge(_existing = [], incoming) {
                return incoming;
              },
            },
            events: {
              merge(_existing = [], incoming) {
                return incoming;
              },
            },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'ignore',
        notifyOnNetworkStatusChange: true,
      },
      query: {
        errorPolicy: 'ignore',
      },
    },
  });
}

export function getApolloClient() {
  // Only create the client once, and only in the browser
  if (typeof window === 'undefined') {
    // On the server, return a new client each time (for SSR)
    return createApolloClient();
  }

  // On the client, reuse the same client instance
  if (!client) {
    client = createApolloClient();
  }

  return client;
}
