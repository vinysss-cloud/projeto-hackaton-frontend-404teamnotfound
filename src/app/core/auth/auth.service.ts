import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

export interface UsuarioLogado {
  id: number;
  matricula: string;
  nomeExibicao: string;
  primeiroAcesso?: boolean;
  ativo?: boolean;
  dataCriacao?: string;
  ultimoAcesso?: string;
}

interface ApiResponse<T> {
  sucesso: boolean;
  mensagem: string;
  dados: T;
  timestamp: string;
}

interface AuthResponse {
  autenticado: boolean;
  usuarioCriado: boolean;
  mensagem: string;
  usuario: UsuarioLogado;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private loggedIn = signal<boolean>(false);

  private readonly usuarioKey = 'sicas_usuario';
  private readonly usuarioIdKey = 'sicas_usuario_id';

  constructor(private http: HttpClient, private router: Router) {
    this.checkInitialSession();
  }

  get isLoggedIn() {
    return this.loggedIn();
  }

  get usuarioAtual(): UsuarioLogado | null {
    const raw = localStorage.getItem(this.usuarioKey);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as UsuarioLogado;
    } catch {
      this.logout(false);
      return null;
    }
  }

  get usuarioId(): number | null {
    const id = localStorage.getItem(this.usuarioIdKey);
    return id ? Number(id) : null;
  }

  private checkInitialSession() {
    const usuario = localStorage.getItem(this.usuarioKey);
    const usuarioId = localStorage.getItem(this.usuarioIdKey);
    this.loggedIn.set(!!usuario && !!usuarioId);
  }

  login(matricula: string, senha: string): Observable<ApiResponse<AuthResponse>> {
    return this.http.post<ApiResponse<AuthResponse>>(`${environment.apiUrl}/auth/login`, {
      matricula,
      senha,
      nomeExibicao: matricula
    }).pipe(
      tap(response => this.persistirSessao(response))
    );
  }

  private persistirSessao(response: ApiResponse<AuthResponse>) {
    const dados = response?.dados;

    if (!response?.sucesso || !dados?.autenticado || !dados?.usuario?.id) {
      throw new Error(response?.mensagem || 'Falha na autenticação.');
    }

    localStorage.setItem(this.usuarioKey, JSON.stringify(dados.usuario));
    localStorage.setItem(this.usuarioIdKey, String(dados.usuario.id));

    this.loggedIn.set(true);
    this.router.navigate(['/dashboard']);
  }

  logout(navigate = true) {
    localStorage.removeItem(this.usuarioKey);
    localStorage.removeItem(this.usuarioIdKey);
    this.loggedIn.set(false);

    if (navigate) {
      this.router.navigate(['/login']);
    }
  }
}
