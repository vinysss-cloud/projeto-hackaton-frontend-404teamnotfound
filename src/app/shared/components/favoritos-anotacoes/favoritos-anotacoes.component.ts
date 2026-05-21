import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnotacaoBackend, FavoritoBackend } from '../../../core/services/portal.service';

@Component({
  selector: 'app-favoritos-anotacoes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './favoritos-anotacoes.component.html',
  styleUrls: ['./favoritos-anotacoes.component.css']
})
export class FavoritosAnotacoesComponent {
  @Input() favoritos: FavoritoBackend[] = [];
  @Input() anotacoes: AnotacaoBackend[] = [];

  fallbackLinks = ['SIAC — Abertura de Conta', 'Consulta FGTS', 'SISMN — Normativo', 'Sistema de Habitação'];
  fallbackNotas = ['Verificar doc. contrato — cliente Pedro', 'Agendar follow-up — Maria', 'Revisar normativo 045/2025'];
}
