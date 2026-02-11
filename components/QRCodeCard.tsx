import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import Icon from './Icon';

interface QRCodeCardProps {
  url: string;
  nome: string;
}

export default function QRCodeCard({ url, nome }: QRCodeCardProps) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    const nomeSanitizado = nome
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '-')
      .toLowerCase();
    link.download = `qrcode-${nomeSanitizado}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="dark:bg-gradient-to-br dark:from-white/[0.03] dark:to-white/[0.01] light:bg-white backdrop-blur-sm rounded-2xl border dark:border-white/[0.05] light:border-gray-200 p-6">
      <h2 className="text-lg font-medium dark:text-white light:text-gray-900 tracking-tight mb-4 flex items-center gap-2">
        <Icon name="qr_code_2" className="text-[20px] text-[#1e5a8d]" />
        QR Code de Cadastro
      </h2>
      <div className="dark:bg-white/[0.02] light:bg-gray-50 rounded-xl p-4 border dark:border-white/[0.05] light:border-gray-200">
        <div className="flex flex-col items-center gap-4">
          <div ref={canvasRef} className="bg-white p-4 rounded-xl">
            <QRCodeCanvas
              value={url}
              size={200}
              level="H"
              marginSize={2}
            />
          </div>
          <p className="text-xs text-gray-500 text-center">
            Escaneie para abrir a página de cadastro de apoiadores
          </p>
          <button
            onClick={handleDownload}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-[#1e5a8d] hover:bg-[#2a6fa8] text-white transition-all flex items-center gap-2"
          >
            <Icon name="download" className="text-[16px]" />
            Baixar QR Code
          </button>
        </div>
      </div>
    </div>
  );
}
