import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiResponse<T> {
  sucesso: boolean;
  mensagem: string;
  dados: T;
  timestamp: string;
}

export interface ServicoBackend {
  id: number;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: string;
  rotaFrontend: string;
  icone: string;
  ordem: number;
  destaque: boolean;
  ativo: boolean;
}

export interface FavoritoBackend {
  id: number;
  usuarioId: number;
  servicoId: number;
  codigoServico: string;
  titulo: string;
  descricao: string;
  categoria: string;
  rotaFrontend: string;
  icone: string;
  observacao: string;
  ativo: boolean;
  dataCriacao: string;
}

export interface AcessoRecenteBackend {
  id: number;
  servicoId: number;
  codigoServico: string;
  titulo: string;
  descricao: string;
  categoria: string;
  rotaFrontend: string;
  icone: string;
  quantidadeAcessos: number;
  ultimoAcesso: string;
}

export interface AnotacaoBackend {
  id: number;
  usuarioId: number;
  titulo: string;
  descricao: string;
  referencia: string;
  ativo: boolean;
  dataCriacao: string;
  dataAtualizacao: string;
}

export interface PortalInicial {
  usuario: {
    id: number;
    matricula: string;
    nomeExibicao: string;
    primeiroAcesso: boolean;
  };
  servicos: ServicoBackend[];
  servicosDestaque: ServicoBackend[];
  favoritos: FavoritoBackend[];
  acessosRecentes: AcessoRecenteBackend[];
  anotacoes: AnotacaoBackend[];
}

@Injectable({
  providedIn: 'root'
})
export class PortalService {
  constructor(private http: HttpClient) {}

  carregarPortalInicial(usuarioId: number): Observable<PortalInicial> {
    return this.http
      .get<ApiResponse<PortalInicial>>(`${environment.apiUrl}/portal/inicial/${usuarioId}`)
      .pipe(map(response => response.dados));
  }
}
