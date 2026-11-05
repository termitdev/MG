import { createFileRoute } from "@tanstack/react-router";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const Route = createFileRoute("/privacidade")({
  head: () => ({ meta: [{ title: "Privacidade — MUGUI" }] }),
  component: () => (
    <>
      <Navbar sectionPrefix="/" />
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-16">
        <p className="text-sm uppercase tracking-widest text-primary">Versão 2026-11-04</p>
        <h1 className="text-4xl font-semibold">Privacidade dos seus dados</h1>
        <p>
          O formulário coleta nome, documento, data de nascimento, e-mail, telefone e finalidade do
          exame para analisar a solicitação e organizar o atendimento.
        </p>
        <h2 className="text-2xl font-semibold">Acesso e compartilhamento</h2>
        <p>
          O acesso interno é restrito a profissionais autorizados. Informações necessárias poderão
          ser encaminhadas ao laboratório contratado quando a integração estiver disponível e
          validada. A confirmação da leitura deste aviso não representa consentimento genérico para
          outros usos.
        </p>
        <h2 className="text-2xl font-semibold">Proteção</h2>
        <p>
          Os documentos são criptografados no armazenamento da aplicação. As operações protegidas
          usam autenticação, controle de permissões e registros de auditoria.
        </p>
        <h2 className="text-2xl font-semibold">Seus direitos e contato</h2>
        <p>
          Solicitações de acesso, correção e informações sobre tratamento e retenção devem ser
          encaminhadas à equipe da MUGUI pelos canais oficiais de atendimento.
        </p>
        <div className="rounded-3xl border border-border bg-surface p-6 text-sm text-muted-foreground">
          Este aviso técnico precisa ser complementado e aprovado pela MUGUI antes da operação:
          identificação e contato do controlador e do encarregado, bases legais aplicáveis,
          laboratório destinatário, transferências internacionais, prazos de retenção e canal de
          atendimento aos titulares. A implementação técnica não constitui declaração de
          conformidade jurídica integral.
        </div>
      </main>
      <Footer sectionPrefix="/" />
    </>
  ),
});
