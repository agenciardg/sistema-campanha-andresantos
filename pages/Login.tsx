
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { useConfig } from '../contexts/ConfigContext';
import { globalRateLimiter } from '../lib/rateLimiter';

const Login: React.FC = () => {
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { signIn, isAuthenticated } = useAuth();
    const { getConfigValue } = useConfig();

    // Redirecionar se já estiver autenticado
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/dashboard');
        }
    }, [isAuthenticated, navigate]);

    const togglePasswordVisibility = () => {
        setPasswordVisible(!passwordVisible);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Verificar rate limit antes de tentar login
        if (!globalRateLimiter.tryConsume('login')) {
            const info = globalRateLimiter.getInfo('login');
            setError('Muitas tentativas de login. Aguarde alguns segundos antes de tentar novamente.');
            return;
        }

        setLoading(true);

        try {
            const { error: signInError } = await signIn(email, senha);

            if (signInError) {
                // Mensagens de erro genéricas para não vazar informações
                // sobre existência de usuários ou outras vulnerabilidades
                let errorMessage = 'Credenciais inválidas. Verifique seu email e senha.';

                // Apenas mensagens que não vazam informações
                if (signInError.message.includes('Too many requests')) {
                    errorMessage = 'Muitas tentativas. Aguarde alguns minutos.';
                } else if (signInError.message.includes('não está configurado')) {
                    errorMessage = 'Sistema indisponível no momento.';
                }
                // Todas as outras mensagens (incluindo "Invalid login credentials",
                // "Email not confirmed", etc.) usam mensagem genérica

                setError(errorMessage);
                return;
            }

            // Login bem-sucedido - verificar role para redirecionar
            // Buscar dados atualizados do usuário para pegar app_metadata
            const { data: { user: loggedUser } } = await import('../lib/supabase').then(m => m.supabase.auth.getUser());

            // Verificar se é superadmin (via app_metadata.role)
            const userRole = (loggedUser as any)?.app_metadata?.role;

            if (userRole === 'superadmin') {
                navigate('/superadmin');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            console.error('Erro no login:', err);
            setError('Erro ao fazer login. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="font-display bg-background-dark dark:text-white light:text-gray-900 min-h-screen flex flex-col antialiased selection:bg-primary selection:text-white">
            <div className="flex min-h-screen w-full grow flex-col items-center justify-center p-4 relative overflow-hidden">
                <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[120px] mix-blend-screen opacity-40"></div>
                    <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-blue-600/10 rounded-full blur-[100px] mix-blend-screen opacity-30"></div>
                </div>

                <div className="relative z-10 w-full max-w-[480px] flex flex-col gap-6 rounded-xl bg-[#1a2632] shadow-2xl border border-[#324d67] p-8 md:p-10">
                    <div className="flex flex-col items-center gap-4">
                        <div className="flex items-center justify-center w-16 h-16 rounded-xl bg-primary/10 text-primary mb-2">
                            <Icon name="campaign" className="text-[32px]" />
                        </div>
                        <div className="flex flex-col items-center justify-center text-center">
                            <h1 className="text-2xl font-bold tracking-tight dark:text-white light:text-gray-900">{getConfigValue('branding.login_titulo')}</h1>
                            <p className="text-[#92adc9] text-sm mt-2">{getConfigValue('branding.login_subtitulo')}</p>
                        </div>
                    </div>

                    <form className="flex flex-col gap-5 mt-2" onSubmit={handleLogin}>
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-white light:text-gray-900" htmlFor="email">
                                Email
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#92adc9]">
                                    <Icon name="mail" className="text-[20px]" />
                                </div>
                                <input
                                    className="flex h-12 w-full rounded-lg border border-[#324d67] bg-[#111a22] px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-[#566e85] focus-visible:outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:text-white light:text-gray-900 transition-all duration-200"
                                    id="email"
                                    placeholder="seu@email.com"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoComplete="email"
                                />
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-medium leading-none dark:text-white light:text-gray-900" htmlFor="password">
                                Senha
                            </label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[#92adc9]">
                                    <Icon name="lock" className="text-[20px]" />
                                </div>
                                <input
                                    className="flex h-12 w-full rounded-lg border border-[#324d67] bg-[#111a22] px-3 py-2 pl-10 text-sm ring-offset-background placeholder:text-[#566e85] focus-visible:outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:text-white light:text-gray-900 transition-all duration-200"
                                    id="password"
                                    placeholder="Digite sua senha"
                                    type={passwordVisible ? "text" : "password"}
                                    value={senha}
                                    onChange={(e) => setSenha(e.target.value)}
                                    required
                                    autoComplete="current-password"
                                />
                                <button
                                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
                                    type="button"
                                    onClick={togglePasswordVisibility}
                                >
                                    <Icon name={passwordVisible ? "visibility" : "visibility_off"} className="text-[20px]" />
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-1">
                            <label className="flex items-center gap-2 cursor-pointer group">
                                <div className="relative flex items-center">
                                    <input className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-[#324d67] bg-[#111a22] checked:border-primary checked:bg-primary transition-all" type="checkbox"/>
                                    <Icon name="check" className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] dark:text-white light:text-gray-900 opacity-0 peer-checked:opacity-100 pointer-events-none" />
                                </div>
                                <span className="text-sm text-[#92adc9] group-hover:dark:text-white light:text-gray-900 transition-colors">Lembrar-me</span>
                            </label>
                            <a className="text-sm font-medium text-primary hover:text-blue-500 hover:underline transition-colors" href="#">
                                Esqueceu a senha?
                            </a>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                <Icon name="error" className="text-[16px]" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="flex w-full items-center justify-center rounded-lg bg-primary h-12 px-5 text-sm font-bold text-white shadow-md hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.98] transition-all duration-200 mt-2 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                    <span>Entrando...</span>
                                </>
                            ) : (
                                <>
                                    <span>Entrar</span>
                                    <Icon name="login" className="text-[18px]" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-2 text-center">
                        <p className="text-xs text-[#566e85]">
                            Protegido por autenticação Supabase
                        </p>
                    </div>
                </div>

                <div className="mt-8 text-center relative z-10">
                    <p className="text-xs text-[#92adc9] flex items-center justify-center gap-2 opacity-70">
                        <Icon name="verified_user" className="text-[14px]" />
                        {getConfigValue('branding.rodape_texto')}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
