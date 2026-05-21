import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { SideMenuComponent } from '../../shared/components/side-menu/side-menu.component';
import { FooterComponent } from '../../shared/components/footer/footer.component';
import { RotinaCardComponent } from '../../shared/components/rotina-card/rotina-card.component';
import { AcessosRecentesComponent } from '../../shared/components/acessos-recentes/acessos-recentes.component';
import { FavoritosAnotacoesComponent } from '../../shared/components/favoritos-anotacoes/favoritos-anotacoes.component';
import { DefinirDestaquesModalComponent } from './components/definir-destaques-modal/definir-destaques-modal.component';
import { Rotina, RotinaService } from '../../core/services/rotina.service';
import { AuthService } from '../../core/auth/auth.service';
import { PortalService, AcessoRecenteBackend, AnotacaoBackend, FavoritoBackend } from '../../core/services/portal.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SideMenuComponent,
    FooterComponent,
    RotinaCardComponent,
    AcessosRecentesComponent,
    FavoritosAnotacoesComponent,
    DefinirDestaquesModalComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
  private rotinaService = inject(RotinaService);
  private authService = inject(AuthService);
  private portalService = inject(PortalService);
  private router = inject(Router);

  rotinas = this.rotinaService.getRotinasSignal();
  destaquesKeys = signal<string[]>([]);

  rotinasDestaque = computed(() => {
    const todas = this.rotinas();
    const chaves = this.destaquesKeys();

    if (!chaves.length) {
      return todas.slice(0, 8);
    }

    const mapa = new Map(todas.map(rotina => [this.chaveRotina(rotina), rotina]));
    const selecionadas = chaves
      .map(chave => mapa.get(chave))
      .filter((rotina): rotina is Rotina => !!rotina);

    return selecionadas.length ? selecionadas.slice(0, 8) : todas.slice(0, 8);
  });

  acessosRecentes = signal<AcessoRecenteBackend[]>([]);
  favoritos = signal<FavoritoBackend[]>([]);
  anotacoes = signal<AnotacaoBackend[]>([]);

  showModal = false;
  loading = false;
  error = '';

  ngOnInit() {
    this.carregarDestaquesSalvos();
    this.carregarPortal();
  }

  carregarPortal() {
    const usuarioId = this.authService.usuarioId;

    if (!usuarioId) {
      this.error = 'Usuário não encontrado na sessão.';
      return;
    }

    this.loading = true;
    this.error = '';

    this.portalService.carregarPortalInicial(usuarioId).subscribe({
      next: (portal) => {
        this.acessosRecentes.set(portal.acessosRecentes || []);
        this.favoritos.set(portal.favoritos || []);
        this.anotacoes.set(portal.anotacoes || []);

        const servicos = portal.servicosDestaque?.length ? portal.servicosDestaque : portal.servicos;
        this.rotinaService.carregarComServicos(usuarioId, servicos || []).subscribe({
          next: () => {
            this.loading = false;
          },
          error: (err) => {
            this.rotinaService.setRotinasFromBackend(servicos || []);
            this.loading = false;
            console.error(err);
          }
        });
      },
      error: (err) => {
        this.error = err?.error?.mensagem || 'Não foi possível carregar os dados do portal.';
        this.loading = false;
        console.error(err);
      }
    });
  }


  abrirAgrupamentoRotina(rotina: Rotina) {
    this.router.navigate(['/rotinas'], {
      queryParams: { rotina: this.chaveRotina(rotina) }
    });
  }

  openModal() {
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
  }

  salvarDestaques(chaves: string[]) {
    const chavesLimitadas = chaves.slice(0, 8);
    this.destaquesKeys.set(chavesLimitadas);
    localStorage.setItem(this.storageKey(), JSON.stringify(chavesLimitadas));
    this.closeModal();
  }

  chaveRotina(rotina: Rotina): string {
    return `${rotina.origem || 'LOCAL'}-${rotina.id ?? rotina.codigo ?? rotina.titulo}`;
  }

  private carregarDestaquesSalvos() {
    try {
      const valor = localStorage.getItem(this.storageKey());
      this.destaquesKeys.set(valor ? JSON.parse(valor) : []);
    } catch {
      this.destaquesKeys.set([]);
    }
  }

  private storageKey(): string {
    return `sicas-destaques-${this.authService.usuarioId || 'anonimo'}`;
  }
}
