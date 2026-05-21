import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Rotina } from '../../../../core/services/rotina.service';

@Component({
  selector: 'app-definir-destaques-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './definir-destaques-modal.component.html',
  styleUrls: ['./definir-destaques-modal.component.css']
})
export class DefinirDestaquesModalComponent implements OnChanges {
  @Input() rotinas: Rotina[] = [];
  @Input() selectedKeys: string[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<string[]>();

  readonly limiteDestaques = 8;
  readonly pageSize = 6;

  termoBusca = '';
  paginaAtual = 1;
  selecao = new Set<string>();
  error = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedKeys']) {
      this.selecao = new Set(this.selectedKeys || []);
    }
  }

  get rotinasFiltradas(): Rotina[] {
    const termo = this.normalizar(this.termoBusca);

    if (!termo) {
      return this.rotinas;
    }

    return this.rotinas.filter(rotina => {
      const texto = this.normalizar(`${rotina.titulo} ${rotina.descricao} ${rotina.categoria || ''} ${rotina.codigo || ''}`);
      return texto.includes(termo);
    });
  }

  get totalPaginas(): number {
    return Math.max(1, Math.ceil(this.rotinasFiltradas.length / this.pageSize));
  }

  get rotinasPaginadas(): Rotina[] {
    if (this.paginaAtual > this.totalPaginas) {
      this.paginaAtual = this.totalPaginas;
    }

    const inicio = (this.paginaAtual - 1) * this.pageSize;
    return this.rotinasFiltradas.slice(inicio, inicio + this.pageSize);
  }

  get totalSelecionadas(): number {
    return this.selecao.size;
  }

  get podeVoltar(): boolean {
    return this.paginaAtual > 1;
  }

  get podeAvancar(): boolean {
    return this.paginaAtual < this.totalPaginas;
  }

  onSearch(valor: string): void {
    this.termoBusca = valor;
    this.paginaAtual = 1;
    this.error = '';
  }

  chaveRotina(rotina: Rotina): string {
    return `${rotina.origem || 'LOCAL'}-${rotina.id ?? rotina.codigo ?? rotina.titulo}`;
  }

  isSelecionada(rotina: Rotina): boolean {
    return this.selecao.has(this.chaveRotina(rotina));
  }

  toggleRotina(rotina: Rotina): void {
    const chave = this.chaveRotina(rotina);

    if (this.selecao.has(chave)) {
      this.selecao.delete(chave);
      this.error = '';
      return;
    }

    if (this.selecao.size >= this.limiteDestaques) {
      this.error = 'Você pode selecionar no máximo 8 rotinas para destaque.';
      return;
    }

    this.selecao.add(chave);
    this.error = '';
  }

  paginaAnterior(): void {
    if (this.podeVoltar) {
      this.paginaAtual--;
    }
  }

  proximaPagina(): void {
    if (this.podeAvancar) {
      this.paginaAtual++;
    }
  }

  limparSelecao(): void {
    this.selecao.clear();
    this.error = '';
  }

  onSave(): void {
    if (this.selecao.size === 0) {
      this.error = 'Selecione pelo menos uma rotina para manter seu ambiente útil.';
      return;
    }

    this.save.emit(Array.from(this.selecao));
  }

  onCancel(): void {
    this.close.emit();
  }

  private normalizar(valor: string): string {
    return (valor || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }
}
