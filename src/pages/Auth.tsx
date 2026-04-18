import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Croissant } from 'lucide-react';

const translateAuthError = (raw: string): string => {
  const msg = (raw || '').toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Credenciales incorrectas. Revisa tu correo y contraseña.';
  }
  if (msg.includes('email not confirmed')) return 'Correo no verificado. Revisa tu bandeja de entrada.';
  if (msg.includes('user not found')) return 'No existe una cuenta con ese correo.';
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  }
  if (msg.includes('network') || msg.includes('fetch')) return 'Error de conexión. Verifica tu internet.';
  if (msg.includes('weak') || msg.includes('password is known')) {
    return 'La contraseña es muy débil. Elige una más segura.';
  }
  if (msg.includes('password should be at least') || msg.includes('password length')) {
    return 'La contraseña es demasiado corta.';
  }
  if (msg.includes('invalid email') || msg.includes('email address') && msg.includes('invalid')) {
    return 'Correo electrónico inválido.';
  }
  if (msg.includes('signups not allowed') || msg.includes('signup is disabled')) {
    return 'El registro de cuentas está deshabilitado. Contacta al administrador.';
  }
  if (msg.includes('already') || msg.includes('exists')) {
    return 'Este correo ya está registrado.';
  }
  return 'Ocurrió un error. Inténtalo nuevamente.';
};

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate('/', { replace: true });
  }, [user, authLoading, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      toast.error(translateAuthError(error.message));
      return;
    }
    toast.success('¡Bienvenido!');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-primary/10 items-center justify-center">
            <Croissant className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-bold">Buenos Días</h1>
          <p className="text-muted-foreground text-sm">Sistema de gestión de repostería</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-base">Iniciar sesión</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-3">
              <div>
                <Label htmlFor="signin-email">Correo</Label>
                <Input
                  id="signin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="signin-password">Contraseña</Label>
                <Input
                  id="signin-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Entrando...' : 'Entrar'}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center pt-2">
                El acceso es solo para personal autorizado.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
