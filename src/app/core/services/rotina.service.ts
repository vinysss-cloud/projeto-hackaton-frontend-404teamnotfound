import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, forkJoin, of, delay, tap, map, catchError, from, concatMap, toArray } from 'rxjs';
import { PortalService, ServicoBackend } from './portal.service';
import { AuthService } from '../auth/auth.service';

export interface Rotina {
  id?: number;
  titulo: string;
  descricao: string;
  icone: string;
  link?: string;
  rotaFrontend?: string;
  codigo?: string;
  categoria?: string;
  origem?: 'SERVICO_INTERNO' | 'SISTEMA_USUARIO' | 'LOCAL';
  editavel?: boolean;
}

export interface ResultadoImportacaoRotinas {
  importadas: number;
  ignoradas: number;
  totalLidas: number;
}

interface AtalhoRotinaArquivoAmbiente {
  nome?: string;
  url?: string;
  fixado?: boolean;
  observacoes?: string;
}

interface RotinaArquivoAmbiente {
  titulo?: string;
  descricao?: string;
  icone?: string;
  link?: string;
  rotaFrontend?: string;
  codigo?: string;
  categoria?: string;
  atalhos?: AtalhoRotinaArquivoAmbiente[];
}

interface ArquivoAmbienteSicas {
  sistema?: string;
  tipo?: string;
  versao?: number;
  exportadoEm?: string;
  atalhos?: unknown[];
  rotinas?: RotinaArquivoAmbiente[];
}

interface ApiResponse<T> {
  sucesso: boolean;
  mensagem: string;
  dados: T;
  timestamp?: string;
}

interface PaginaBackend<T> {
  itens: T[];
  totalElementos: number;
  totalPaginas: number;
  pagina: number;
  tamanho: number;
  primeira: boolean;
  ultima: boolean;
  possuiProxima: boolean;
  possuiAnterior: boolean;
}

interface SistemaUsuarioBackend {
  id: number;
  usuarioId: number;
  nome: string;
  descricao?: string;
  url?: string;
  categoria?: string;
  icone?: string;
  favorito?: boolean;
  ativo?: boolean;
  dataCriacao?: string;
  dataAtualizacao?: string;
}

interface SistemaUsuarioRequest {
  usuarioId: number;
  nome: string;
  descricao?: string;
  url?: string;
  categoria?: string;
  icone?: string;
  favorito?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class RotinaService {
  private http = inject(HttpClient);
  private portalService = inject(PortalService);
  private authService = inject(AuthService);

  private rotinas = signal<Rotina[]>([]);

  private fallbackRotinas: Rotina[] = [
    { titulo: 'Cobrança', descricao: 'Boletos, títulos e gestão de cobranças bancárias.', icone: 'currency-exchange0.svg', link: 'https://siac.caixa.gov.br', categoria: 'Atendimento', origem: 'LOCAL' },
    { titulo: 'Jurídico', descricao: 'Atendimento de crédito imobiliário e financiamentos.', icone: 'balance0.svg', link: 'https://juridico.caixa.gov.br', categoria: 'Jurídico', origem: 'LOCAL' },
    { titulo: 'Precatório / RPV', descricao: 'Gestão de precatórios e requisições de pagamento.', icone: 'gavel0.svg', link: 'https://precatorio.caixa.gov.br', categoria: 'Operacional', origem: 'LOCAL' },
    { titulo: 'Normativo', descricao: 'Consulta a normas, circulares e regulamentações.', icone: 'policy0.svg', link: 'https://normativo.caixa.gov.br', categoria: 'Normativos', origem: 'LOCAL' },
    { titulo: 'Agendamento', descricao: 'Consulta de pagamentos agendados e autorização.', icone: 'calendar-month0.svg', link: 'https://agenda.caixa.gov.br', categoria: 'Atendimento', origem: 'LOCAL' },
    { titulo: 'Empréstimos', descricao: 'Contratação e gestão de operações de empréstimos.', icone: 'currency-exchange0.svg', link: 'https://emprestimos.caixa.gov.br', categoria: 'Crédito', origem: 'LOCAL' },
    { titulo: 'Exclusão', descricao: 'Exclusão de registros ou contratos integrados.', icone: 'do-not-disturb-on0.svg', link: 'https://exclusao.caixa.gov.br', categoria: 'Operacional', origem: 'LOCAL' },
    { titulo: 'Manutenção de Ativos', descricao: 'Controle de ativos e manutenção patrimonial.', icone: 'build0.svg', link: 'https://ativos.caixa.gov.br', categoria: 'Patrimônio', origem: 'LOCAL' },
    { titulo: 'Abertura de Conta', descricao: 'Inicie o processo de abertura de conta completo.', icone: 'account-circle0.svg', link: 'https://siac.caixa.gov.br', categoria: 'Conta', origem: 'LOCAL' },
    { titulo: 'Habitação', descricao: 'Atendimento de crédito imobiliário e financiamentos.', icone: 'maps-home-work0.svg', link: 'https://habitacao.caixa.gov.br', categoria: 'Habitação', origem: 'LOCAL' },
    { titulo: 'Social', descricao: 'Benefícios sociais, FGTS e programas governamentais.', icone: 'handshake0.svg', link: 'https://social.caixa.gov.br', categoria: 'Social', origem: 'LOCAL' },
    { titulo: 'Pessoa Jurídica', descricao: 'Produtos e serviços para empresas e MEIs.', icone: 'gavel0.svg', link: 'https://pj.caixa.gov.br', categoria: 'Pessoa Jurídica', origem: 'LOCAL' }
  ];

  constructor() {
    this.rotinas.set(this.fallbackRotinas);
  }

  getRotinasSignal() {
    return this.rotinas;
  }

  carregarDoBackend(usuarioId: number): Observable<Rotina[]> {
    return forkJoin({
      portal: this.portalService.carregarPortalInicial(usuarioId),
      sistemasUsuario: this.listarSistemasUsuario(usuarioId)
    }).pipe(
      map(({ portal, sistemasUsuario }) => {
        const servicos = portal.servicosDestaque?.length ? portal.servicosDestaque : portal.servicos;
        return this.combinarRotinas(servicos || [], sistemasUsuario || []);
      }),
      tap(rotinas => this.rotinas.set(rotinas.length ? rotinas : this.fallbackRotinas))
    );
  }

  carregarComServicos(usuarioId: number, servicos: ServicoBackend[] = []): Observable<Rotina[]> {
    return this.listarSistemasUsuario(usuarioId).pipe(
      map(sistemasUsuario => this.combinarRotinas(servicos, sistemasUsuario || [])),
      tap(rotinas => this.rotinas.set(rotinas.length ? rotinas : this.fallbackRotinas))
    );
  }

  setRotinasFromBackend(servicos: ServicoBackend[] = []) {
    const rotinas = servicos.map(servico => this.mapearServicoParaRotina(servico));
    this.rotinas.set(rotinas.length ? rotinas : this.fallbackRotinas);
  }

  adicionarRotina(novaRotina: Rotina): Observable<Rotina> {
    const usuarioId = this.authService.usuarioId;

    if (environment.useMock || !usuarioId) {
      const rotinaLocal: Rotina = {
        ...novaRotina,
        origem: 'LOCAL',
        editavel: true
      };

      return of(rotinaLocal).pipe(
        delay(300),
        tap(rotina => this.rotinas.update(rotinas => [rotina, ...rotinas]))
      );
    }

    const request: SistemaUsuarioRequest = {
      usuarioId,
      nome: novaRotina.titulo,
      descricao: novaRotina.descricao,
      url: novaRotina.link || novaRotina.rotaFrontend,
      categoria: novaRotina.categoria || 'Rotina do usuário',
      icone: novaRotina.icone || 'playlist-add-circle0.svg',
      favorito: true
    };

    return this.http.post<ApiResponse<SistemaUsuarioBackend>>(`${environment.apiUrl}/sistemas`, request).pipe(
      map(response => this.mapearSistemaUsuarioParaRotina(response.dados)),
      tap(rotinaPersistida => {
        this.rotinas.update(rotinas => [rotinaPersistida, ...rotinas]);
      })
    );
  }

  atualizarRotina(rotina: Rotina): Observable<Rotina> {
    const usuarioId = this.authService.usuarioId;

    if (!rotina.id || !usuarioId || rotina.origem !== 'SISTEMA_USUARIO') {
      return of(rotina);
    }

    const request: SistemaUsuarioRequest = {
      usuarioId,
      nome: rotina.titulo,
      descricao: rotina.descricao,
      url: rotina.link || rotina.rotaFrontend,
      categoria: rotina.categoria || 'Rotina do usuário',
      icone: rotina.icone,
      favorito: true
    };

    return this.http.put<ApiResponse<SistemaUsuarioBackend>>(`${environment.apiUrl}/sistemas/${rotina.id}`, request).pipe(
      map(response => this.mapearSistemaUsuarioParaRotina(response.dados)),
      tap(rotinaAtualizada => {
        this.rotinas.update(rotinas => rotinas.map(item => item.id === rotinaAtualizada.id && item.origem === 'SISTEMA_USUARIO' ? rotinaAtualizada : item));
      })
    );
  }

  removerRotina(rotina: Rotina): Observable<void> {
    if (!rotina.id || rotina.origem !== 'SISTEMA_USUARIO') {
      return of(void 0);
    }

    return this.http.delete<ApiResponse<void>>(`${environment.apiUrl}/sistemas/${rotina.id}`).pipe(
      map(() => void 0),
      tap(() => {
        this.rotinas.update(rotinas => rotinas.filter(item => !(item.id === rotina.id && item.origem === 'SISTEMA_USUARIO')));
      })
    );
  }

  gerarDadosExportacao(): RotinaArquivoAmbiente[] {
    return this.rotinas()
      .filter(rotina => rotina.origem !== 'SERVICO_INTERNO')
      .map(rotina => {
        const atalhos = this.carregarAtalhosInternosDaRotina(rotina);

        return {
          titulo: rotina.titulo,
          descricao: rotina.descricao || '',
          icone: rotina.icone || 'playlist-add-circle0.svg',
          link: rotina.link || rotina.rotaFrontend || '',
          rotaFrontend: rotina.rotaFrontend || rotina.link || '',
          codigo: rotina.codigo || '',
          categoria: rotina.categoria || 'Rotina do usuário',
          atalhos: atalhos.length ? atalhos : undefined
        };
      });
  }

  importarArquivoAmbiente(conteudo: string): Observable<ResultadoImportacaoRotinas> {
    const rotinasArquivo = this.extrairRotinasDoArquivo(conteudo);
    const existentes = new Set(this.rotinas().map(rotina => this.criarChaveDuplicidade(rotina)));
    const totalLidas = rotinasArquivo.length;

    const rotinasParaImportar = rotinasArquivo.filter(rotina => {
      const titulo = rotina.titulo?.trim();
      const link = rotina.link?.trim() || rotina.rotaFrontend?.trim();
      const chave = this.criarChaveDuplicidade({
        titulo: titulo || '',
        link: link || '',
        rotaFrontend: link || ''
      });

      if (!titulo || existentes.has(chave)) {
        return false;
      }

      existentes.add(chave);
      return true;
    });

    const totalIgnoradas = totalLidas - rotinasParaImportar.length;

    if (rotinasParaImportar.length === 0) {
      return of({ importadas: 0, ignoradas: totalIgnoradas, totalLidas });
    }

    return from(rotinasParaImportar).pipe(
      concatMap(rotinaArquivo => {
        const rotinaParaSalvar: Rotina = {
          titulo: rotinaArquivo.titulo!.trim(),
          descricao: rotinaArquivo.descricao?.trim() || 'Rotina importada de outro ambiente.',
          icone: this.normalizarIcone(rotinaArquivo.icone),
          link: this.normalizarUrl((rotinaArquivo.link || rotinaArquivo.rotaFrontend || '#').trim()),
          rotaFrontend: this.normalizarUrl((rotinaArquivo.rotaFrontend || rotinaArquivo.link || '#').trim()),
          codigo: rotinaArquivo.codigo?.trim() || undefined,
          categoria: rotinaArquivo.categoria?.trim() || 'Rotina do usuário'
        };

        return this.adicionarRotina(rotinaParaSalvar).pipe(
          tap(rotinaCriada => {
            const atalhosInternos = this.normalizarAtalhosInternos(rotinaArquivo.atalhos || []);
            if (atalhosInternos.length) {
              this.salvarAtalhosInternosDaRotina(rotinaCriada, atalhosInternos);
            }
          })
        );
      }),
      toArray(),
      map(importadas => ({
        importadas: importadas.length,
        ignoradas: totalIgnoradas,
        totalLidas
      }))
    );
  }

  private extrairRotinasDoArquivo(conteudo: string): RotinaArquivoAmbiente[] {
    try {
      const dados = JSON.parse(conteudo) as ArquivoAmbienteSicas | RotinaArquivoAmbiente[];
      const rotinas = Array.isArray(dados) ? dados : dados.rotinas;

      if (!Array.isArray(rotinas)) {
        if (!Array.isArray(dados) && Array.isArray(dados.atalhos)) {
          return [];
        }

        throw new Error('Arquivo sem lista de rotinas.');
      }

      return rotinas
        .filter(rotina => !!rotina)
        .map(rotina => ({
          titulo: String(rotina.titulo || '').trim(),
          descricao: String(rotina.descricao || '').trim(),
          icone: this.normalizarIcone(rotina.icone),
          link: this.normalizarUrl(String(rotina.link || rotina.rotaFrontend || '#').trim()),
          rotaFrontend: this.normalizarUrl(String(rotina.rotaFrontend || rotina.link || '#').trim()),
          codigo: String(rotina.codigo || '').trim(),
          categoria: String(rotina.categoria || 'Rotina do usuário').trim(),
          atalhos: Array.isArray(rotina.atalhos) ? rotina.atalhos : []
        }));
    } catch {
      throw new Error('Arquivo inválido. Exporte novamente o ambiente e tente importar o novo arquivo.');
    }
  }

  private carregarAtalhosInternosDaRotina(rotina: Rotina): AtalhoRotinaArquivoAmbiente[] {
    try {
      const salvo = localStorage.getItem(this.chaveStorageAtalhos(rotina));
      if (!salvo) {
        return [];
      }

      const atalhos = JSON.parse(salvo) as AtalhoRotinaArquivoAmbiente[];
      return this.normalizarAtalhosInternos(Array.isArray(atalhos) ? atalhos : []);
    } catch {
      return [];
    }
  }

  private salvarAtalhosInternosDaRotina(rotina: Rotina, atalhos: AtalhoRotinaArquivoAmbiente[]): void {
    localStorage.setItem(this.chaveStorageAtalhos(rotina), JSON.stringify(this.normalizarAtalhosInternos(atalhos)));
  }

  private normalizarAtalhosInternos(atalhos: AtalhoRotinaArquivoAmbiente[]): AtalhoRotinaArquivoAmbiente[] {
    return atalhos
      .filter(atalho => !!atalho?.nome?.trim() && !!atalho?.url?.trim())
      .map(atalho => ({
        nome: String(atalho.nome || '').trim(),
        url: this.normalizarUrl(String(atalho.url || '').trim()),
        fixado: !!atalho.fixado,
        observacoes: String(atalho.observacoes || '').trim()
      }))
      .sort((a, b) => {
        if (!!a.fixado !== !!b.fixado) {
          return Number(!!b.fixado) - Number(!!a.fixado);
        }

        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' });
      });
  }

  private chaveStorageAtalhos(rotina: Rotina): string {
    const usuario = this.authService.usuarioId || 'local';
    const identificador = rotina.id
      ? `${rotina.origem || 'rotina'}-${rotina.id}`
      : this.normalizarTexto(`${rotina.titulo}-${rotina.codigo || rotina.categoria || ''}`).replace(/\s+/g, '-');

    return `sicas-atalhos-rotina-${usuario}-${identificador}`;
  }

  private criarChaveDuplicidade(rotina: Pick<Rotina, 'titulo' | 'link' | 'rotaFrontend'>): string {
    const titulo = this.normalizarTexto(rotina.titulo || '');
    const link = this.normalizarUrl(rotina.link || rotina.rotaFrontend || '').toLowerCase().replace(/\/$/, '');
    return `${titulo}|${link}`;
  }

  private normalizarTexto(valor: string): string {
    return (valor || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private normalizarUrl(url: string): string {
    if (!url || url === '#') {
      return '#';
    }

    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  private listarSistemasUsuario(usuarioId: number): Observable<SistemaUsuarioBackend[]> {
    return this.http
      .get<ApiResponse<PaginaBackend<SistemaUsuarioBackend>>>(`${environment.apiUrl}/sistemas/usuario/${usuarioId}?pagina=0&tamanho=50`)
      .pipe(
        map(response => response.dados?.itens || []),
        catchError(error => {
          console.error('Não foi possível carregar rotinas do usuário.', error);
          return of([]);
        })
      );
  }

  private combinarRotinas(servicos: ServicoBackend[], sistemasUsuario: SistemaUsuarioBackend[]): Rotina[] {
    const rotinasUsuario = sistemasUsuario.map(sistema => this.mapearSistemaUsuarioParaRotina(sistema));
    const rotinasGlobais = servicos.map(servico => this.mapearServicoParaRotina(servico));

    return [...rotinasUsuario, ...rotinasGlobais];
  }

  private mapearServicoParaRotina(servico: ServicoBackend): Rotina {
    return {
      id: servico.id,
      codigo: servico.codigo,
      titulo: servico.titulo,
      descricao: servico.descricao,
      categoria: servico.categoria,
      rotaFrontend: servico.rotaFrontend,
      icone: this.normalizarIcone(servico.icone),
      link: servico.rotaFrontend,
      origem: 'SERVICO_INTERNO',
      editavel: false
    };
  }

  private mapearSistemaUsuarioParaRotina(sistema: SistemaUsuarioBackend): Rotina {
    return {
      id: sistema.id,
      titulo: sistema.nome,
      descricao: sistema.descricao || 'Rotina adicionada ao seu ambiente.',
      categoria: sistema.categoria || 'Rotina do usuário',
      rotaFrontend: sistema.url,
      link: sistema.url,
      icone: this.normalizarIcone(sistema.icone),
      origem: 'SISTEMA_USUARIO',
      editavel: true
    };
  }

  private normalizarIcone(icone?: string): string {
    if (!icone || icone.trim() === '') {
      return 'account-circle0.svg';
    }

    if (icone.endsWith('.svg') || icone.endsWith('.png')) {
      return icone;
    }

    const mapa: Record<string, string> = {
      account: 'account-circle0.svg',
      account_circle: 'account-circle0.svg',
      home: 'maps-home-work0.svg',
      habitacao: 'maps-home-work0.svg',
      handshake: 'handshake0.svg',
      social: 'handshake0.svg',
      gavel: 'gavel0.svg',
      juridico: 'balance0.svg',
      balance: 'balance0.svg',
      request_page: 'request-page0.svg',
      cobranca: 'request-page0.svg',
      policy: 'policy0.svg',
      normativo: 'policy0.svg',
      playlist: 'playlist-add-circle0.svg',
      playlist_add: 'playlist-add-circle0.svg'
    };

    return mapa[icone] || 'account-circle0.svg';
  }
}
