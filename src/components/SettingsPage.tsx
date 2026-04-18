import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Store, Phone, Building, CreditCard, LogOut } from 'lucide-react';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { storeSettings, updateStoreSettings } = useStore();
  const [storeName, setStoreName] = useState(storeSettings?.storeName || '');
  const [phone, setPhone] = useState(storeSettings?.phone || '');
  const [bank, setBank] = useState(storeSettings?.bank || '');
  const [cedula, setCedula] = useState(storeSettings?.cedula || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (storeSettings) {
      setStoreName(storeSettings.storeName);
      setPhone(storeSettings.phone);
      setBank(storeSettings.bank);
      setCedula(storeSettings.cedula);
    }
  }, [storeSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateStoreSettings({ storeName, phone, bank, cedula });
      toast.success('Configuración guardada');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-2xl font-display font-bold">Configuración</h1>
        <p className="text-muted-foreground text-sm">Datos de la tienda</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="w-4 h-4" />Datos generales
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Nombre de la tienda</Label>
            <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="Buenos Días" />
          </div>
          <div>
            <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Teléfono para pagos</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+584121234567" />
            <p className="text-[10px] text-muted-foreground mt-1">Se incluirá en los mensajes de cobro</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4" />Datos bancarios para cobros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="flex items-center gap-1.5"><Building className="w-3.5 h-3.5" />Banco</Label>
            <Input value={bank} onChange={(e) => setBank(e.target.value)} placeholder="Banesco, Mercantil, etc." />
          </div>
          <div>
            <Label>Cédula / RIF</Label>
            <Input value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="V-12345678" />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" onClick={handleSave} disabled={saving}>
        {saving ? 'Guardando...' : 'Guardar configuración'}
      </Button>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sesión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {user && (
            <p className="text-xs text-muted-foreground">
              Conectado como <span className="font-medium text-foreground">{user.email}</span>
            </p>
          )}
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await signOut();
              navigate('/auth', { replace: true });
            }}
          >
            <LogOut className="w-4 h-4 mr-2" />Cerrar sesión
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
