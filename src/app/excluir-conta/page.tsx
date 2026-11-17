import type { Metadata } from 'next';

import { DeleteAccountView } from '@/components/account-deletion/delete-account-view';

export const metadata: Metadata = {
  title: 'Excluir conta | Hub Community',
  description:
    'Exclua a sua conta do Hub Community: veja o que é apagado e o que fica, e confirme com um código enviado ao seu e-mail.',
};

export default function ExcluirContaPage() {
  return <DeleteAccountView />;
}
