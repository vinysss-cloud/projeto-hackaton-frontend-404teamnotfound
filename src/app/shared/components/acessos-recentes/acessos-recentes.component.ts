import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AcessoRecenteBackend } from '../../../core/services/portal.service';

@Component({
  selector: 'app-acessos-recentes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './acessos-recentes.component.html',
  styleUrls: ['./acessos-recentes.component.css']
})
export class AcessosRecentesComponent {
  @Input() recentes: AcessoRecenteBackend[] = [];

  fallback = [
    { titulo: 'Cobrança', icone: 'request-page1.svg' },
    { titulo: 'Jurídico', icone: 'balance1.svg' },
    { titulo: 'Precatório / RPV', icone: 'gavel2.svg' },
    { titulo: 'Normativo', icone: 'policy1.svg' }
  ];

  get itens() {
    return this.recentes?.length ? this.recentes : this.fallback;
  }

  normalizarIcone(icone?: string): string {
    if (!icone) {
      return 'request-page1.svg';
    }
    return icone.endsWith('.svg') || icone.endsWith('.png') ? icone : 'request-page1.svg';
  }
}
