import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { GET_CERTIFICATE_REQUEST_FORM, SUBMIT_CERTIFICATE_REQUEST } from '@/lib/queries';
import SolicitarCertificadoPage from '../page';

vi.mock('next/navigation', () => ({
  useParams: () => ({ slug: 'startup-weekend-anapolis-mentor' }),
}));

const formMock: MockedResponse = {
  request: {
    query: GET_CERTIFICATE_REQUEST_FORM,
    variables: { slug: 'startup-weekend-anapolis-mentor' },
  },
  result: {
    data: {
      certificateRequestForm: {
        __typename: 'CertificateRequestFormPage',
        title: 'Certificado de mentoria',
        category: 'Mentor',
        description: null,
        enabled: true,
        event: {
          __typename: 'CertificateConfigEvent',
          id: 'e1',
          slug: 'startup-weekend-anapolis',
          title: 'Startup Weekend Anápolis',
          start_date: '2026-08-01T12:00:00.000Z',
        },
      },
    },
  },
};

const submitMock = (dateOfBirth: string | null): MockedResponse => ({
  request: {
    query: SUBMIT_CERTIFICATE_REQUEST,
    variables: {
      slug: 'startup-weekend-anapolis-mentor',
      name: 'Ana Souza',
      identifier: '52998224725',
      email: 'ana@x.io',
      phone: '62999990000',
      date_of_birth: dateOfBirth,
    },
  },
  result: {
    data: {
      submitCertificateRequest: {
        __typename: 'CertificateRequestReceipt',
        ok: true,
        category: 'Mentor',
        event_title: 'Startup Weekend Anápolis',
      },
    },
  },
});

const renderIt = (mocks: MockedResponse[]) =>
  render(
    <MockedProvider mocks={mocks}>
      <SolicitarCertificadoPage />
    </MockedProvider>,
  );

// Every field is required, so a submit only reaches the handler with the whole form filled.
const fillForm = async (cpf = '52998224725') => {
  await userEvent.type(screen.getByLabelText(/Nome completo/), 'Ana Souza');
  await userEvent.type(screen.getByLabelText('CPF'), cpf);
  await userEvent.type(screen.getByLabelText('Data de nascimento'), '1990-04-07');
  await userEvent.type(screen.getByLabelText('E-mail'), 'ana@x.io');
  await userEvent.type(screen.getByLabelText('WhatsApp'), '62999990000');
};

describe('página pública de solicitação de certificado', () => {
  it('pede a data de nascimento e não aceita uma data futura', async () => {
    renderIt([formMock]);

    const field = (await screen.findByLabelText('Data de nascimento')) as HTMLInputElement;
    expect(field.type).toBe('date');
    expect(field.required).toBe(true);
    expect(field.max).toBe(new Date().toISOString().slice(0, 10));
  });

  it('envia a data de nascimento junto com o resto', async () => {
    renderIt([formMock, submitMock('1990-04-07')]);

    await screen.findByLabelText('Data de nascimento');
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: /Enviar solicitação/ }));

    expect(await screen.findByText('Solicitação enviada')).toBeInTheDocument();
  });

  it('barra um CPF inválido antes de chamar o servidor', async () => {
    renderIt([formMock]);

    await screen.findByLabelText('Data de nascimento');
    await fillForm('11111111111');
    await userEvent.click(screen.getByRole('button', { name: /Enviar solicitação/ }));

    await waitFor(() => expect(screen.getByText('CPF inválido.')).toBeInTheDocument());
  });
});
