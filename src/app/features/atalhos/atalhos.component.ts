import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AtalhoService } from '../../core/services/atalho.service';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { SideMenuComponent } from '../../shared/components/side-menu/side-menu.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';

@Component({
  selector: 'app-atalhos',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, SideMenuComponent, FooterComponent],
  templateUrl: './atalhos.component.html',
  styleUrls: ['./atalhos.component.css']
})
export class AtalhosComponent implements OnInit {
  private atalhoService = inject(AtalhoService);

  atalhos = this.atalhoService.getAtalhosSignal();
  termoConsulta = signal('');
  mostrarFormulario = signal(false);
  paginaAtual = signal(1);
  readonly itensPorPagina = 10;
  carregando = signal(false);
  erro = signal('');

  novoAtalho = {
    nome: '',
    url: '',
    fixado: false,
    observacoes: ''
  };


  ngOnInit() {
    this.carregarAtalhos();
  }

  carregarAtalhos() {
    this.carregando.set(true);
    this.erro.set('');

    this.atalhoService.carregarDoBackend().subscribe({
      next: () => {
        this.carregando.set(false);
        this.irParaPagina(1);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível carregar seus atalhos. Tente novamente.');
      }
    });
  }

  atalhosFiltrados = computed(() => {
    const termo = this.termoConsulta().trim().toLowerCase();
    const atalhosFiltrados = !termo
      ? [...this.atalhos()]
      : this.atalhos().filter(atalho =>
          atalho.nome.toLowerCase().includes(termo) ||
          atalho.url.toLowerCase().includes(termo) ||
          atalho.observacoes.toLowerCase().includes(termo)
        );

    return this.ordenarAtalhosPorFixacao(atalhosFiltrados);
  });

  totalItens = computed(() => this.atalhosFiltrados().length);

  totalPaginas = computed(() => Math.max(1, Math.ceil(this.totalItens() / this.itensPorPagina)));

  atalhosPaginados = computed(() => {
    const paginaSegura = Math.min(Math.max(this.paginaAtual(), 1), this.totalPaginas());
    const inicio = (paginaSegura - 1) * this.itensPorPagina;
    return this.atalhosFiltrados().slice(inicio, inicio + this.itensPorPagina);
  });

  inicioExibicao = computed(() => {
    if (this.totalItens() === 0) {
      return 0;
    }

    return (this.paginaAtual() - 1) * this.itensPorPagina + 1;
  });

  fimExibicao = computed(() => Math.min(this.paginaAtual() * this.itensPorPagina, this.totalItens()));

  paginasVisiveis = computed(() => {
    const total = this.totalPaginas();
    const atual = this.paginaAtual();
    const inicio = Math.max(1, atual - 2);
    const fim = Math.min(total, inicio + 4);
    const inicioAjustado = Math.max(1, fim - 4);

    return Array.from({ length: fim - inicioAjustado + 1 }, (_, index) => inicioAjustado + index);
  });

  consultar() {
    this.termoConsulta.set(this.termoConsulta().trim());
    this.irParaPagina(1);
  }

  limparConsulta() {
    this.termoConsulta.set('');
    this.irParaPagina(1);
  }

  abrirCadastro() {
    this.mostrarFormulario.set(true);
  }

  cancelarCadastro() {
    this.mostrarFormulario.set(false);
    this.limparFormulario();
  }

  salvarAtalho() {
    const nome = this.novoAtalho.nome.trim();
    const url = this.normalizarUrl(this.novoAtalho.url.trim());
    const observacoes = this.novoAtalho.observacoes.trim();

    if (!nome || !url) {
      return;
    }

    this.carregando.set(true);
    this.erro.set('');

    this.atalhoService.adicionarAtalho({
      nome,
      url,
      fixado: this.novoAtalho.fixado,
      observacoes: observacoes || 'Atalho cadastrado pelo usuário.'
    }).subscribe({
      next: () => {
        this.carregando.set(false);
        this.cancelarCadastro();
        this.irParaPagina(1);
      },
      error: () => {
        this.carregando.set(false);
        this.erro.set('Não foi possível salvar o atalho na base. Verifique o backend e tente novamente.');
      }
    });
  }

  togglePin(id: string) {
    this.erro.set('');
    this.atalhoService.toggleFixado(id).subscribe({
      error: () => this.erro.set('Não foi possível atualizar o atalho na base.')
    });
  }

  deleteAtalho(id: string) {
    this.erro.set('');

    this.atalhoService.excluirAtalho(id).subscribe({
      next: () => {
        if (this.paginaAtual() > this.totalPaginas()) {
          this.irParaPagina(this.totalPaginas());
        }
      },
      error: () => this.erro.set('Não foi possível excluir o atalho da base.')
    });
  }

  irParaPagina(pagina: number) {
    const paginaSegura = Math.min(Math.max(pagina, 1), this.totalPaginas());
    this.paginaAtual.set(paginaSegura);
  }

  paginaAnterior() {
    this.irParaPagina(this.paginaAtual() - 1);
  }

  proximaPagina() {
    this.irParaPagina(this.paginaAtual() + 1);
  }

  private irParaUltimaPagina() {
    this.irParaPagina(this.totalPaginas());
  }

  private ordenarAtalhosPorFixacao<T extends { fixado: boolean; nome: string }>(atalhos: T[]): T[] {
    return [...atalhos].sort((a, b) => {
      if (a.fixado !== b.fixado) {
        return Number(b.fixado) - Number(a.fixado);
      }

      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    });
  }

  private normalizarUrl(url: string): string {
    if (!url) {
      return url;
    }

    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  private limparFormulario() {
    this.novoAtalho = {
      nome: '',
      url: '',
      fixado: false,
      observacoes: ''
    };
  }
}
