import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import {
  CREATE_CERTIFICATE_REQUEST_FORM,
  GET_CERTIFICATE_REQUEST_FORMS,
} from '@/lib/queries';
import { CertificateRequestForms, publicFormUrl } from '../certificate-request-forms';

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: mockToast }) }));

const form = (id: string, title: string, category: string, slug: string, submissions: number) => ({
  __typename: 'CertificateRequestForm',
  id,
  title,
  category,
  slug,
  description: null,
  enabled: true,
  submissions,
});

const listMock = (forms: unknown[]): MockedResponse => ({
  request: { query: GET_CERTIFICATE_REQUEST_FORMS, variables: { eventId: 'e1' } },
  result: { data: { certificateRequestForms: forms } },
});

const renderIt = (mocks: MockedResponse[]) =>
  render(
    <MockedProvider mocks={mocks}>
      <CertificateRequestForms eventId="e1" />
    </MockedProvider>,
  );

beforeEach(() => {
  mockToast.mockClear();
});

describe('publicFormUrl', () => {
  it('builds the link the organizer shares', () => {
    expect(publicFormUrl('summit-mentor', 'https://hub.test')).toBe(
      'https://hub.test/certificado/solicitar/summit-mentor',
    );
  });
});

describe('CertificateRequestForms', () => {
  it('lists each form with its category, link and submission count', async () => {
    renderIt([listMock([form('f1', 'Certificado de mentoria', 'Mentor', 'summit-mentor', 4)])]);

    expect(await screen.findByText('Certificado de mentoria')).toBeInTheDocument();
    expect(screen.getByText('Mentor')).toBeInTheDocument();
    expect(screen.getByText('4 solicitação(ões)')).toBeInTheDocument();
    expect(screen.getByText('/certificado/solicitar/summit-mentor')).toBeInTheDocument();
  });

  it('says the participante list still stands when there is no form yet', async () => {
    renderIt([listMock([])]);
    expect(await screen.findByText(/Nenhum formulário ainda/)).toBeInTheDocument();
  });

  it('creates a form with the category that was typed', async () => {
    const created = form('f2', 'Certificado de organização', 'Organizador', 'summit-organizador', 0);
    const createMock: MockedResponse = {
      request: {
        query: CREATE_CERTIFICATE_REQUEST_FORM,
        variables: {
          eventId: 'e1',
          data: {
            title: 'Certificado de organização',
            category: 'Organizador',
            description: null,
            enabled: true,
          },
        },
      },
      result: { data: { createCertificateRequestForm: created } },
    };
    renderIt([listMock([]), createMock, listMock([created])]);

    await userEvent.click(await screen.findByRole('button', { name: /Novo formulário/ }));
    await userEvent.type(screen.getByLabelText('Título'), 'Certificado de organização');
    await userEvent.type(screen.getByLabelText('Categoria'), 'Organizador');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ title: 'Formulário criado' }));
  });

  it('refuses to save without a title', async () => {
    renderIt([listMock([])]);

    await userEvent.click(await screen.findByRole('button', { name: /Novo formulário/ }));
    await userEvent.type(screen.getByLabelText('Categoria'), 'Mentor');
    await userEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Título é obrigatório' }),
    );
  });
});
