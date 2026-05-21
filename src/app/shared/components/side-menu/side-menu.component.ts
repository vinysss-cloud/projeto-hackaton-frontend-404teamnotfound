import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AtalhoService } from '../../../core/services/atalho.service';
import { RotinaService } from '../../../core/services/rotina.service';

type SaveFilePicker = (options?: {
  suggestedName?: string;
  types?: Array<{
    description: string;
    accept: Record<string, string[]>;
  }>;
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './side-menu.component.html',
  styleUrls: ['./side-menu.component.css']
})
export class SideMenuComponent {
  private atalhoService = inject(AtalhoService);
  private rotinaService = inject(RotinaService);
  private timerMensagem?: ReturnType<typeof setTimeout>;

  @ViewChild('inputImportarAmbiente') inputImportarAmbiente?: ElementRef<HTMLInputElement>;

  mensagem = signal('');
  tipoMensagem = signal<'sucesso' | 'erro'>('sucesso');
  processandoArquivo = signal(false);
  mostrarModalAmbiente = signal(false);

  abrirModalAmbiente(): void {
    this.mostrarModalAmbiente.set(true);
  }

  fecharModalAmbiente(): void {
    this.mostrarModalAmbiente.set(false);
  }

  abrirImportacao(): void {
    this.fecharModalAmbiente();
    this.inputImportarAmbiente?.nativeElement.click();
  }

  importarAmbiente(event: Event): void {
    const input = event.target as HTMLInputElement;
    const arquivo = input.files?.[0];

    if (!arquivo) {
      return;
    }

    this.processandoArquivo.set(true);
    const leitor = new FileReader();

    leitor.onload = () => {
      const conteudo = String(leitor.result || '');

      forkJoin({
        atalhos: this.atalhoService.importarArquivoAmbiente(conteudo),
        rotinas: this.rotinaService.importarArquivoAmbiente(conteudo)
      }).subscribe({
        next: resultado => {
          this.processandoArquivo.set(false);
          input.value = '';
          this.exibirMensagem(
            `Ambiente importado: ${resultado.atalhos.importados} atalho(s) e ${resultado.rotinas.importadas} rotina(s) nova(s). Ignorados: ${resultado.atalhos.ignorados + resultado.rotinas.ignoradas}.`,
            'sucesso'
          );
        },
        error: erro => {
          this.processandoArquivo.set(false);
          input.value = '';
          this.exibirMensagem(erro?.message || 'Não foi possível importar o ambiente.', 'erro');
        }
      });
    };

    leitor.onerror = () => {
      this.processandoArquivo.set(false);
      input.value = '';
      this.exibirMensagem('Não foi possível ler o arquivo selecionado.', 'erro');
    };

    leitor.readAsText(arquivo, 'UTF-8');
  }

  async exportarAmbiente(): Promise<void> {
    this.fecharModalAmbiente();

    try {
      const conteudo = this.gerarConteudoExportacaoAmbiente();
      const blob = new Blob([conteudo], { type: 'text/plain;charset=utf-8' });
      const nomeArquivo = `sicas-ambiente-${new Date().toISOString().slice(0, 10)}.txt`;
      const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;

      if (picker) {
        const handle = await picker({
          suggestedName: nomeArquivo,
          types: [{
            description: 'Arquivo de ambiente SICAS',
            accept: { 'text/plain': ['.txt'] }
          }]
        });
        const writable = await handle.createWritable();
        await writable.write(blob);
        await writable.close();
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivo;
        link.click();
        URL.revokeObjectURL(url);
      }

      this.exibirMensagem('Ambiente exportado com sucesso.', 'sucesso');
    } catch (erro) {
      if ((erro as Error)?.name !== 'AbortError') {
        this.exibirMensagem('Não foi possível exportar o ambiente.', 'erro');
      }
    }
  }

  private gerarConteudoExportacaoAmbiente(): string {
    return JSON.stringify({
      sistema: 'SICAS - Central de Acessos e Serviços Internos',
      tipo: 'EXPORTACAO_AMBIENTE_USUARIO',
      versao: 2,
      exportadoEm: new Date().toISOString(),
      atalhos: this.atalhoService.gerarDadosExportacao(),
      rotinas: this.rotinaService.gerarDadosExportacao()
    }, null, 2);
  }

  private exibirMensagem(texto: string, tipo: 'sucesso' | 'erro'): void {
    this.mensagem.set(texto);
    this.tipoMensagem.set(tipo);

    if (this.timerMensagem) {
      clearTimeout(this.timerMensagem);
    }

    this.timerMensagem = setTimeout(() => this.mensagem.set(''), 4000);
  }
}
