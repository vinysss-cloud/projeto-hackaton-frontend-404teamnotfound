import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, concatMap, from, map, of, tap, toArray } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

export interface Atalho {
  id: string;
  nome: string;
  url: string;
  fixado: boolean;
  observacoes: string;
  origem?: 'SISTEMA_USUARIO' | 'LOCAL';
  editavel?: boolean;
}

export interface ResultadoImportacaoAtalhos {
  importados: number;
  ignorados: number;
  totalLidos: number;
}

interface ArquivoAmbienteSicas {
  sistema?: string;
  tipo?: string;
  versao?: number;
  exportadoEm?: string;
  atalhos?: AtalhoArquivoAmbiente[];
  rotinas?: unknown[];
}

interface AtalhoArquivoAmbiente {
  nome?: string;
  url?: string;
  fixado?: boolean;
  observacoes?: string;
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
export class AtalhoService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);

  private readonly categoriaAtalho = 'Atalho do usuário';

  private fallbackAtalhos: Atalho[] = [
    { id: 'local-1', nome: 'Google', url: 'https://www.google.com', fixado: true, observacoes: 'Mecanismo de busca principal da empresa.', origem: 'LOCAL', editavel: false },
    { id: 'local-2', nome: 'YouTube', url: 'https://www.youtube.com', fixado: true, observacoes: 'Plataforma para hospedagem de vídeos institucionais.', origem: 'LOCAL', editavel: false },
    { id: 'local-3', nome: 'GitHub', url: 'https://www.github.com', fixado: true, observacoes: 'Repositório oficial dos projetos de código aberto.', origem: 'LOCAL', editavel: false },
    { id: 'local-4', nome: 'Stack Overflow', url: 'https://stackoverflow.com', fixado: true, observacoes: 'Fórum de auxílio para a equipe de desenvolvimento.', origem: 'LOCAL', editavel: false },
    { id: 'local-5', nome: 'Wikipedia', url: 'https://www.wikipedia.org', fixado: true, observacoes: 'Fonte de consulta geral e pesquisa rápida.', origem: 'LOCAL', editavel: false },
    { id: 'local-6', nome: 'Portal do Aluno', url: 'https://aluno.universidade.edu.br', fixado: true, observacoes: 'Acesso às notas e frequência escolar.', origem: 'LOCAL', editavel: false },
    { id: 'local-7', nome: 'Sistema ERP', url: 'https://erp.empresa.com.br', fixado: true, observacoes: 'Gestão financeira e faturamento interno.', origem: 'LOCAL', editavel: false },
    { id: 'local-8', nome: 'Trello', url: 'https://trello.com', fixado: true, observacoes: 'Organização de tarefas e projetos em kanban.', origem: 'LOCAL', editavel: false },
    { id: 'local-9', nome: 'Notion', url: 'https://notion.so', fixado: false, observacoes: 'Documentação interna e base de conhecimento.', origem: 'LOCAL', editavel: false },
    { id: 'local-10', nome: 'Slack', url: 'https://slack.com', fixado: false, observacoes: 'Comunicação oficial em tempo real entre equipes.', origem: 'LOCAL', editavel: false },
    { id: 'local-11', nome: 'Canva', url: 'https://canva.com', fixado: false, observacoes: 'Criação de artes rápidas para redes sociais.', origem: 'LOCAL', editavel: false },
    { id: 'local-12', nome: 'LinkedIn', url: 'https://www.linkedin.com', fixado: false, observacoes: 'Rede para recrutamento e seleção de talentos.', origem: 'LOCAL', editavel: false }
  ];

  private atalhos = signal<Atalho[]>(this.fallbackAtalhos);

  getAtalhosSignal() {
    return this.atalhos;
  }

  carregarDoBackend(): Observable<Atalho[]> {
    const usuarioId = this.authService.usuarioId;

    if (environment.useMock || !usuarioId) {
      this.atalhos.set(this.fallbackAtalhos);
      return of(this.fallbackAtalhos);
    }

    return this.http
      .get<ApiResponse<PaginaBackend<SistemaUsuarioBackend>>>(`${environment.apiUrl}/sistemas/usuario/${usuarioId}?pagina=0&tamanho=50`)
      .pipe(
        map(response => response.dados?.itens || []),
        map(sistemas => sistemas
          .filter(sistema => this.ehAtalhoUsuario(sistema))
          .map(sistema => this.mapearSistemaParaAtalho(sistema))
        ),
        map(atalhosUsuario => [...atalhosUsuario, ...this.fallbackAtalhos]),
        tap(atalhos => this.atalhos.set(this.ordenarAtalhosPorFixacao(atalhos))),
        catchError(error => {
          console.error('Não foi possível carregar atalhos do usuário.', error);
          this.atalhos.set(this.fallbackAtalhos);
          return of(this.fallbackAtalhos);
        })
      );
  }

  adicionarAtalho(atalho: Omit<Atalho, 'id' | 'origem' | 'editavel'>): Observable<Atalho> {
    const usuarioId = this.authService.usuarioId;

    if (environment.useMock || !usuarioId) {
      const novoAtalho: Atalho = {
        ...atalho,
        id: crypto?.randomUUID?.() ?? String(Date.now()),
        origem: 'LOCAL',
        editavel: true
      };

      this.atalhos.update(atalhos => this.ordenarAtalhosPorFixacao([novoAtalho, ...atalhos]));
      return of(novoAtalho);
    }

    const request: SistemaUsuarioRequest = {
      usuarioId,
      nome: atalho.nome,
      descricao: atalho.observacoes || 'Atalho cadastrado pelo usuário.',
      url: atalho.url,
      categoria: this.categoriaAtalho,
      icone: 'link',
      favorito: atalho.fixado
    };

    return this.http.post<ApiResponse<SistemaUsuarioBackend>>(`${environment.apiUrl}/sistemas`, request).pipe(
      map(response => this.mapearSistemaParaAtalho(response.dados)),
      tap(atalhoPersistido => {
        this.atalhos.update(atalhos => this.ordenarAtalhosPorFixacao([atalhoPersistido, ...atalhos]));
      })
    );
  }

  toggleFixado(id: string): Observable<Atalho | null> {
    const atalho = this.atalhos().find(item => item.id === id);

    if (!atalho) {
      return of(null);
    }

    const novoFixado = !atalho.fixado;

    if (atalho.origem !== 'SISTEMA_USUARIO') {
      this.atalhos.update(atalhos => this.ordenarAtalhosPorFixacao(atalhos.map(item => item.id === id ? { ...item, fixado: novoFixado } : item)));
      return of({ ...atalho, fixado: novoFixado });
    }

    const usuarioId = this.authService.usuarioId;
    const sistemaId = Number(atalho.id);

    if (!usuarioId || Number.isNaN(sistemaId)) {
      return of(null);
    }

    const request: SistemaUsuarioRequest = {
      usuarioId,
      nome: atalho.nome,
      descricao: atalho.observacoes,
      url: atalho.url,
      categoria: this.categoriaAtalho,
      icone: 'link',
      favorito: novoFixado
    };

    return this.http.put<ApiResponse<SistemaUsuarioBackend>>(`${environment.apiUrl}/sistemas/${sistemaId}`, request).pipe(
      map(response => this.mapearSistemaParaAtalho(response.dados)),
      tap(atalhoAtualizado => {
        this.atalhos.update(atalhos => this.ordenarAtalhosPorFixacao(atalhos.map(item => item.id === id ? atalhoAtualizado : item)));
      })
    );
  }

  excluirAtalho(id: string): Observable<void> {
    const atalho = this.atalhos().find(item => item.id === id);

    if (!atalho || atalho.origem !== 'SISTEMA_USUARIO') {
      this.atalhos.update(atalhos => atalhos.filter(item => item.id !== id));
      return of(void 0);
    }

    const sistemaId = Number(atalho.id);

    if (Number.isNaN(sistemaId)) {
      return of(void 0);
    }

    return this.http.delete<ApiResponse<void>>(`${environment.apiUrl}/sistemas/${sistemaId}`).pipe(
      map(() => void 0),
      tap(() => {
        this.atalhos.update(atalhos => atalhos.filter(item => item.id !== id));
      })
    );
  }

  gerarDadosExportacao(): AtalhoArquivoAmbiente[] {
    return this.ordenarAtalhosPorFixacao(this.atalhos())
      .map(atalho => ({
        nome: atalho.nome,
        url: atalho.url,
        fixado: atalho.fixado,
        observacoes: atalho.observacoes || ''
      }));
  }

  gerarArquivoExportacao(): string {
    const arquivo: ArquivoAmbienteSicas = {
      sistema: 'SICAS - Central de Acessos e Serviços Internos',
      tipo: 'EXPORTACAO_AMBIENTE_USUARIO',
      versao: 2,
      exportadoEm: new Date().toISOString(),
      atalhos: this.gerarDadosExportacao()
    };

    return JSON.stringify(arquivo, null, 2);
  }

  importarArquivoAmbiente(conteudo: string): Observable<ResultadoImportacaoAtalhos> {
    const atalhosArquivo = this.extrairAtalhosDoArquivo(conteudo);
    const existentes = new Set(this.atalhos().map(atalho => this.criarChaveDuplicidade(atalho)));
    const ignoradosIniciais = atalhosArquivo.length;

    const atalhosParaImportar = atalhosArquivo.filter(atalho => {
      const chave = this.criarChaveDuplicidade(atalho);

      if (!atalho.nome?.trim() || !atalho.url?.trim() || existentes.has(chave)) {
        return false;
      }

      existentes.add(chave);
      return true;
    });

    const totalIgnorados = ignoradosIniciais - atalhosParaImportar.length;

    if (atalhosParaImportar.length === 0) {
      return of({ importados: 0, ignorados: totalIgnorados, totalLidos: atalhosArquivo.length });
    }

    return from(atalhosParaImportar).pipe(
      concatMap(atalho => this.adicionarAtalho({
        nome: atalho.nome!.trim(),
        url: this.normalizarUrl(atalho.url!.trim()),
        fixado: !!atalho.fixado,
        observacoes: atalho.observacoes?.trim() || 'Atalho importado de outro ambiente.'
      })),
      toArray(),
      map(importados => ({
        importados: importados.length,
        ignorados: totalIgnorados,
        totalLidos: atalhosArquivo.length
      }))
    );
  }

  private extrairAtalhosDoArquivo(conteudo: string): AtalhoArquivoAmbiente[] {
    try {
      const dados = JSON.parse(conteudo) as ArquivoAmbienteSicas | AtalhoArquivoAmbiente[];
      const atalhos = Array.isArray(dados) ? dados : dados.atalhos;

      if (!Array.isArray(atalhos)) {
        if (!Array.isArray(dados) && Array.isArray(dados.rotinas)) {
          return [];
        }

        throw new Error('Arquivo sem lista de atalhos.');
      }

      return atalhos
        .filter(atalho => !!atalho)
        .map(atalho => ({
          nome: String(atalho.nome || '').trim(),
          url: this.normalizarUrl(String(atalho.url || '').trim()),
          fixado: !!atalho.fixado,
          observacoes: String(atalho.observacoes || '').trim()
        }));
    } catch {
      throw new Error('Arquivo inválido. Exporte novamente o ambiente e tente importar o novo arquivo.');
    }
  }

  private criarChaveDuplicidade(atalho: Pick<AtalhoArquivoAmbiente, 'nome' | 'url'>): string {
    const nome = this.normalizarTexto(atalho.nome || '');
    const url = this.normalizarUrl(atalho.url || '').toLowerCase().replace(/\/$/, '');
    return `${nome}|${url}`;
  }

  private ordenarAtalhosPorFixacao<T extends { fixado: boolean; nome: string }>(atalhos: T[]): T[] {
    return [...atalhos].sort((a, b) => {
      if (a.fixado !== b.fixado) {
        return Number(b.fixado) - Number(a.fixado);
      }

      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    });
  }

  private normalizarTexto(valor: string): string {
    return (valor || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
  }

  private normalizarUrl(url: string): string {
    if (!url || url === '#') {
      return '#';
    }

    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  private ehAtalhoUsuario(sistema: SistemaUsuarioBackend): boolean {
    return (sistema.categoria || '').toLowerCase() === this.categoriaAtalho.toLowerCase();
  }

  private mapearSistemaParaAtalho(sistema: SistemaUsuarioBackend): Atalho {
    return {
      id: String(sistema.id),
      nome: sistema.nome,
      url: sistema.url || '#',
      fixado: !!sistema.favorito,
      observacoes: sistema.descricao || 'Atalho cadastrado pelo usuário.',
      origem: 'SISTEMA_USUARIO',
      editavel: true
    };
  }
}
