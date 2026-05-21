import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { SideMenuComponent } from '../../shared/components/side-menu/side-menu.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { AdicionarRotinaModalComponent } from '../dashboard/components/adicionar-rotina-modal/adicionar-rotina-modal.component';
import { Rotina, RotinaService } from '../../core/services/rotina.service';
import { AuthService } from '../../core/auth/auth.service';
import { ActivatedRoute } from '@angular/router';

interface AtalhoRotina {
  id: string;
  nome: string;
  url: string;
  fixado: boolean;
  observacoes: string;
}

@Component({
  selector: 'app-rotinas',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, SideMenuComponent, FooterComponent, AdicionarRotinaModalComponent],
  templateUrl: './rotinas.component.html',
  styleUrls: ['./rotinas.component.css']
})
export class RotinasComponent implements OnInit {
  private rotinaService = inject(RotinaService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);

  rotinas = this.rotinaService.getRotinasSignal();

  termoBusca = signal('');
  paginaAtual = signal(1);
  readonly itensPorPagina = 10;

  rotinaSelecionada = signal<Rotina | null>(null);
  atalhosDaRotina = signal<AtalhoRotina[]>([]);
  termoAtalho = signal('');
  paginaAtalhoAtual = signal(1);
  readonly atalhosPorPagina = 8;

  showModal = false;
  showAtalhoModal = false;
  loading = false;
  error = '';
  private rotinaSolicitadaNaRota: string | null = null;

  novoAtalho: Omit<AtalhoRotina, 'id'> = {
    nome: '',
    url: '',
    fixado: true,
    observacoes: ''
  };

  rotinasFiltradas = computed(() => {
    const termo = this.normalizarTexto(this.termoBusca());

    if (!termo) {
      return this.rotinas();
    }

    return this.rotinas().filter(rotina => {
      const conteudo = this.normalizarTexto([
        rotina.titulo,
        rotina.descricao,
        rotina.categoria,
        rotina.codigo
      ].filter(Boolean).join(' '));

      return conteudo.includes(termo);
    });
  });

  totalItens = computed(() => this.rotinasFiltradas().length);

  totalPaginas = computed(() => {
    const total = Math.ceil(this.totalItens() / this.itensPorPagina);
    return total > 0 ? total : 1;
  });

  rotinasPaginadas = computed(() => {
    const paginaSegura = Math.min(this.paginaAtual(), this.totalPaginas());
    const inicio = (paginaSegura - 1) * this.itensPorPagina;
    const fim = inicio + this.itensPorPagina;
    return this.rotinasFiltradas().slice(inicio, fim);
  });

  paginasVisiveis = computed(() => {
    const total = this.totalPaginas();
    const atual = Math.min(this.paginaAtual(), total);
    const inicio = Math.max(1, atual - 2);
    const fim = Math.min(total, inicio + 4);
    const ajustadoInicio = Math.max(1, fim - 4);

    return Array.from({ length: fim - ajustadoInicio + 1 }, (_, index) => ajustadoInicio + index);
  });

  inicioExibicao = computed(() => {
    if (this.totalItens() === 0) {
      return 0;
    }
    return ((Math.min(this.paginaAtual(), this.totalPaginas()) - 1) * this.itensPorPagina) + 1;
  });

  fimExibicao = computed(() => {
    return Math.min(Math.min(this.paginaAtual(), this.totalPaginas()) * this.itensPorPagina, this.totalItens());
  });

  atalhosFiltrados = computed(() => {
    const termo = this.normalizarTexto(this.termoAtalho());
    const atalhos = this.atalhosDaRotina();

    if (!termo) {
      return atalhos;
    }

    return atalhos.filter(atalho => this.normalizarTexto(`${atalho.nome} ${atalho.url} ${atalho.observacoes}`).includes(termo));
  });

  totalAtalhos = computed(() => this.atalhosFiltrados().length);

  totalPaginasAtalhos = computed(() => Math.max(1, Math.ceil(this.totalAtalhos() / this.atalhosPorPagina)));

  atalhosPaginados = computed(() => {
    const paginaSegura = Math.min(Math.max(this.paginaAtalhoAtual(), 1), this.totalPaginasAtalhos());
    const inicio = (paginaSegura - 1) * this.atalhosPorPagina;
    return this.atalhosFiltrados().slice(inicio, inicio + this.atalhosPorPagina);
  });

  paginasAtalhosVisiveis = computed(() => {
    const total = this.totalPaginasAtalhos();
    const atual = Math.min(this.paginaAtalhoAtual(), total);
    const inicio = Math.max(1, atual - 2);
    const fim = Math.min(total, inicio + 4);
    const ajustadoInicio = Math.max(1, fim - 4);

    return Array.from({ length: fim - ajustadoInicio + 1 }, (_, index) => ajustadoInicio + index);
  });

  inicioAtalhoExibicao = computed(() => {
    if (this.totalAtalhos() === 0) {
      return 0;
    }

    return ((Math.min(this.paginaAtalhoAtual(), this.totalPaginasAtalhos()) - 1) * this.atalhosPorPagina) + 1;
  });

  fimAtalhoExibicao = computed(() => Math.min(Math.min(this.paginaAtalhoAtual(), this.totalPaginasAtalhos()) * this.atalhosPorPagina, this.totalAtalhos()));

  constructor() {
    effect(() => {
      if (this.paginaAtalhoAtual() > this.totalPaginasAtalhos()) {
        this.paginaAtalhoAtual.set(this.totalPaginasAtalhos());
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      this.rotinaSolicitadaNaRota = params.get('rotina');
      this.selecionarRotinaSolicitada();
    });

    this.carregarRotinasDoBackend();
  }

  carregarRotinasDoBackend(): void {
    const usuarioId = this.authService.usuarioId;

    if (!usuarioId) {
      return;
    }

    this.loading = true;
    this.error = '';

    this.rotinaService.carregarDoBackend(usuarioId).subscribe({
      next: () => {
        this.loading = false;
        this.ajustarPaginaAtual();
        this.selecionarRotinaSolicitada();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.mensagem || 'Não foi possível carregar as rotinas do backend. Exibindo dados locais.';
        this.selecionarRotinaSolicitada();
        console.error(err);
      }
    });
  }

  consultar(): void {
    this.paginaAtual.set(1);
  }

  limparConsulta(): void {
    this.termoBusca.set('');
    this.paginaAtual.set(1);
  }

  irParaPagina(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginas()) {
      return;
    }

    this.paginaAtual.set(pagina);
  }

  paginaAnterior(): void {
    this.irParaPagina(this.paginaAtual() - 1);
  }

  proximaPagina(): void {
    this.irParaPagina(this.paginaAtual() + 1);
  }

  openModal(): void {
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.ajustarPaginaAtual();
  }

  abrirRotina(rotina: Rotina): void {
    this.rotinaSelecionada.set(rotina);
    this.termoAtalho.set('');
    this.paginaAtalhoAtual.set(1);
    this.atalhosDaRotina.set(this.carregarAtalhosDaRotina(rotina));
  }

  voltarParaRotinas(): void {
    this.rotinaSelecionada.set(null);
    this.termoAtalho.set('');
    this.paginaAtalhoAtual.set(1);
  }

  abrirAtalho(atalho: AtalhoRotina): void {
    if (!atalho.url || atalho.url === '#') {
      return;
    }

    window.open(atalho.url, '_blank', 'noopener,noreferrer');
  }

  abrirModalAtalho(): void {
    const rotina = this.rotinaSelecionada();

    this.novoAtalho = {
      nome: rotina?.titulo || '',
      url: rotina?.link || rotina?.rotaFrontend || '',
      fixado: true,
      observacoes: ''
    };

    this.showAtalhoModal = true;
  }

  fecharModalAtalho(): void {
    this.showAtalhoModal = false;
    this.limparNovoAtalho();
  }

  salvarAtalho(): void {
    const rotina = this.rotinaSelecionada();
    const nome = this.novoAtalho.nome.trim();
    const url = this.normalizarUrl(this.novoAtalho.url.trim());
    const observacoes = this.novoAtalho.observacoes.trim();

    if (!rotina || !nome || !url) {
      return;
    }

    const atalho: AtalhoRotina = {
      id: crypto?.randomUUID?.() ?? String(Date.now()),
      nome,
      url,
      fixado: this.novoAtalho.fixado,
      observacoes: observacoes || 'Atalho salvo dentro desta rotina.'
    };

    const atualizados = [atalho, ...this.atalhosDaRotina()];
    this.atalhosDaRotina.set(atualizados);
    this.salvarAtalhosDaRotina(rotina, atualizados);
    this.fecharModalAtalho();
    this.paginaAtalhoAtual.set(1);
  }

  excluirAtalho(event: MouseEvent, atalho: AtalhoRotina): void {
    event.stopPropagation();
    const rotina = this.rotinaSelecionada();

    if (!rotina) {
      return;
    }

    const atualizados = this.atalhosDaRotina().filter(item => item.id !== atalho.id);
    this.atalhosDaRotina.set(atualizados);
    this.salvarAtalhosDaRotina(rotina, atualizados);
  }

  alternarFixado(event: MouseEvent, atalho: AtalhoRotina): void {
    event.stopPropagation();
    const rotina = this.rotinaSelecionada();

    if (!rotina) {
      return;
    }

    const atualizados = this.atalhosDaRotina().map(item => item.id === atalho.id ? { ...item, fixado: !item.fixado } : item);
    this.atalhosDaRotina.set(atualizados);
    this.salvarAtalhosDaRotina(rotina, atualizados);
  }

  consultarAtalhos(): void {
    this.termoAtalho.set(this.termoAtalho().trim());
    this.paginaAtalhoAtual.set(1);
  }

  limparConsultaAtalhos(): void {
    this.termoAtalho.set('');
    this.paginaAtalhoAtual.set(1);
  }

  irParaPaginaAtalho(pagina: number): void {
    if (pagina < 1 || pagina > this.totalPaginasAtalhos()) {
      return;
    }

    this.paginaAtalhoAtual.set(pagina);
  }

  paginaAtalhoAnterior(): void {
    this.irParaPaginaAtalho(this.paginaAtalhoAtual() - 1);
  }

  proximaPaginaAtalho(): void {
    this.irParaPaginaAtalho(this.paginaAtalhoAtual() + 1);
  }

  fixarRotina(event: MouseEvent): void {
    event.stopPropagation();
  }

  trackByAtalho(_: number, atalho: AtalhoRotina): string {
    return atalho.id;
  }


  chaveRotina(rotina: Rotina): string {
    return `${rotina.origem || 'LOCAL'}-${rotina.id ?? rotina.codigo ?? rotina.titulo}`;
  }

  private selecionarRotinaSolicitada(): void {
    const chave = this.rotinaSolicitadaNaRota;

    if (!chave || this.rotinaSelecionada()) {
      return;
    }

    const rotina = this.rotinas().find(item => this.chaveRotina(item) === chave);

    if (rotina) {
      this.abrirRotina(rotina);
    }
  }

  private carregarAtalhosDaRotina(rotina: Rotina): AtalhoRotina[] {
    const chave = this.chaveStorageAtalhos(rotina);
    const salvo = localStorage.getItem(chave);

    if (salvo) {
      try {
        const atalhos = JSON.parse(salvo) as AtalhoRotina[];
        if (Array.isArray(atalhos)) {
          return atalhos;
        }
      } catch {
        localStorage.removeItem(chave);
      }
    }

    const iniciais = this.criarAtalhosIniciais(rotina);
    this.salvarAtalhosDaRotina(rotina, iniciais);
    return iniciais;
  }

  private salvarAtalhosDaRotina(rotina: Rotina, atalhos: AtalhoRotina[]): void {
    localStorage.setItem(this.chaveStorageAtalhos(rotina), JSON.stringify(atalhos));
  }

  private criarAtalhosIniciais(rotina: Rotina): AtalhoRotina[] {
    const titulo = rotina.titulo || 'Rotina';
    const categoria = rotina.categoria || 'Rotina do usuário';
    const linkPrincipal = rotina.link || rotina.rotaFrontend || '#';

    const base: AtalhoRotina[] = [
      {
        id: 'principal',
        nome: titulo,
        url: this.normalizarUrl(linkPrincipal),
        fixado: true,
        observacoes: rotina.descricao || `Acesso principal para ${titulo}.`
      },
      {
        id: 'consulta',
        nome: `Consulta ${titulo}`,
        url: this.normalizarUrl(linkPrincipal),
        fixado: true,
        observacoes: `Consulta rápida relacionada ao agrupamento ${categoria}.`
      },
      {
        id: 'normativo',
        nome: `Normativo ${titulo}`,
        url: 'https://normativo.caixa.gov.br',
        fixado: false,
        observacoes: 'Apoio normativo e orientações institucionais para execução da rotina.'
      }
    ];

    return base;
  }

  private chaveStorageAtalhos(rotina: Rotina): string {
    const usuario = this.authService.usuarioId || 'local';
    const identificador = rotina.id ? `${rotina.origem || 'rotina'}-${rotina.id}` : this.normalizarTexto(`${rotina.titulo}-${rotina.codigo || rotina.categoria || ''}`).replace(/\s+/g, '-');
    return `sicas-atalhos-rotina-${usuario}-${identificador}`;
  }

  private ajustarPaginaAtual(): void {
    if (this.paginaAtual() > this.totalPaginas()) {
      this.paginaAtual.set(this.totalPaginas());
    }
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

  private limparNovoAtalho(): void {
    this.novoAtalho = {
      nome: '',
      url: '',
      fixado: true,
      observacoes: ''
    };
  }
}
