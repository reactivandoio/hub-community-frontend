import { Github, Linkedin } from 'lucide-react';
import Link from 'next/link';

export function Footer() {
  return (
    <footer className="px-4 pb-4 pt-8">
      <div className="container mx-auto max-w-6xl">
        {/* Main Footer Content */}
        <div className="bg-zinc-900 dark:bg-zinc-950 text-white rounded-2xl shadow-lg shadow-black/10 dark:shadow-black/30 border border-zinc-800/50 overflow-hidden">
          <div className="px-8 py-10">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Brand */}
              <div>
                <h3 className="text-2xl font-bold mb-4">Hub Community</h3>
                <p className="text-zinc-400 mb-4 text-sm leading-relaxed">
                  Conectando desenvolvedores e comunidades de tecnologia em todo o
                  Brasil.
                </p>
                <div className="flex space-x-4">
                  <a
                    target="blank"
                    href="https://github.com/reactivando-Community/"
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    <Github className="h-5 w-5" />
                  </a>
                  <a
                    target="blank"
                    href="https://www.linkedin.com/company/reactivando/posts/?feedView=all"
                    className="text-zinc-400 hover:text-white transition-colors"
                  >
                    <Linkedin className="h-5 w-5" />
                  </a>
                </div>
              </div>

              {/* Links */}
              <div>
                <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-zinc-300">Navegação</h4>
                <ul className="space-y-2.5 text-zinc-400 text-sm">
                  <li>
                    <Link href="/" className="hover:text-white transition-colors">
                      Início
                    </Link>
                  </li>
                  <li>
                    <Link href="/communities" className="hover:text-white transition-colors">
                      Comunidades
                    </Link>
                  </li>
                  <li>
                    <Link href="/events" className="hover:text-white transition-colors">
                      Eventos
                    </Link>
                  </li>
                  <li>
                    <Link href="/about" className="hover:text-white transition-colors">
                      Sobre
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Support */}
              <div>
                <h4 className="font-semibold mb-4 text-sm uppercase tracking-wider text-zinc-300">Suporte</h4>
                <ul className="space-y-2.5 text-zinc-400 text-sm">
                  <li>
                    <Link href="/help" className="hover:text-white transition-colors">
                      Ajuda
                    </Link>
                  </li>
                  <li>
                    <Link href="/contact" className="hover:text-white transition-colors">
                      Contato
                    </Link>
                  </li>
                  <li>
                    <Link href="/privacy" className="hover:text-white transition-colors">
                      Privacidade
                    </Link>
                  </li>
                  <li>
                    <Link href="/cookies" className="hover:text-white transition-colors">
                      Cookies
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms" className="hover:text-white transition-colors">
                      Termos
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="border-t border-zinc-800 px-8 py-5">
            <p className="text-center text-zinc-500 text-sm">
              &copy; {new Date().getFullYear()} Hub Community. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
