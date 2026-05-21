import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Rotina } from '../../../core/services/rotina.service';

@Component({
  selector: 'app-rotina-card',
  standalone: true,
  templateUrl: './rotina-card.component.html',
  styleUrls: ['./rotina-card.component.css']
})
export class RotinaCardComponent {
  @Input() rotina!: Rotina;
  @Output() abrir = new EventEmitter<Rotina>();

  onCardClick() {
    this.abrir.emit(this.rotina);
  }
}
