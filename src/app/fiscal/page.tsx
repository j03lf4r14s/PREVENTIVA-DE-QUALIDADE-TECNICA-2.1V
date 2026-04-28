'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import styles from './fiscal.module.css';

/* ============================================================
   CONSTANTS
   ============================================================ */
const MAX_PHOTOS = 30;
const MAX_CHARS = 3000;

const TECHNICIANS = [
  'Anderson Silva',
  'Bruno Oliveira',
  'Carlos Santos',
  'Diego Ferreira',
  'Eduardo Costa',
  'Felipe Alves',
  'Gabriel Lima',
  'Henrique Souza',
  'Igor Martins',
  'João Paulo',
  'Lucas Rodrigues',
];

const CHECKLIST_ITEMS = [
  {
    id: 'c01',
    label: 'Acomodação da fibra na CTO',
    tooltip:
      'Verificar se a caixa está com splitter instalado corretamente (OK) ou se está organizada com rolinho e plaqueta de identificação.',
  },
  {
    id: 'c02',
    label: 'Identificação do DROP',
    tooltip:
      'Verificar se o cabo do cliente está identificado com anilha numerada ou com lacre de identificação.',
  },
  {
    id: 'c03',
    label: 'CTO correta conforme projeto',
    tooltip:
      'Verificar se a caixa utilizada é a mesma registrada no sistema — ou seja, a CTO que consta na facilidade do cliente.',
  },
  {
    id: 'c04',
    label: 'Identificação da CTO',
    tooltip:
      'Verificar se o cliente está na porta correta da CTO, conforme registrado no sistema.',
  },
  {
    id: 'c05',
    label: 'Organização interna da CTO',
    tooltip:
      'Verificar se não há pontas de cabo cortado soltas dentro da caixa e se não existem conectores de cabos abandonados no interior.',
  },
  {
    id: 'c06',
    label: 'Trajeto do DROP',
    tooltip:
      'Verificar se o cabo DROP está posicionado com cunhas altas e nos suportes dos postes ao longo de todo o trajeto.',
  },
  {
    id: 'c07',
    label: 'Fixação em fachada',
    tooltip:
      'Verificar se a fixação na fachada está realizada com suporte DM ou com PTR (presilha tipo roldana).',
  },
  {
    id: 'c08',
    label: 'Entrada do cabo na residência',
    tooltip:
      'Verificar se o cabo está completamente fixado na residência, sem pontos soltos ou mal presos.',
  },
  {
    id: 'c09',
    label: 'Instalação do PTO ou Alta Fusão',
    tooltip:
      'Verificar conforme o tipo de visita: se for visita de fiscalização feita diretamente ao cliente, conferir a instalação do PTO ou da alta fusão no local.',
  },
  {
    id: 'c10',
    label: 'Teste WiFi e IPv6',
    tooltip:
      'Verificar conforme a situação: se a visita for acompanhada do técnico, realizar o teste no local; se for visita de auditoria, verificar os resultados no sistema.',
  },
  {
    id: 'c11',
    label: 'Parâmetros da fibra',
    tooltip:
      'Verificar conforme a situação: se a visita for com o técnico no local, conferir os parâmetros presencialmente; se for auditoria, verificar no sistema.',
  },
  {
    id: 'c12',
    label: 'Cliente orientado sobre WiFi',
    tooltip:
      'Verificar somente em visitas realizadas com o técnico presente: confirmar se o cliente foi devidamente orientado sobre o uso e configurações do WiFi.',
  },
  {
    id: 'c13',
    label: 'Organização geral da instalação',
    tooltip:
      'Verificar se o cabo está fixado corretamente na residência do cliente e se a caixa está organizada — sem folgas, sem excesso de cabo e sem bagunça.',
  },
  {
    id: 'c14',
    label: 'Uso de EPI pelo técnico',
    tooltip:
      'Verificar somente quando a visita for realizada com o técnico no local: confirmar se o técnico está utilizando os Equipamentos de Proteção Individual necessários.',
  },
  {
    id: 'c15',
    label: 'Registro fotográfico',
    tooltip:
      'Verificar somente em visitas de auditoria: conferir no sistema de arquivos do cliente se as fotos estão registradas na ordem correta e completas.',
  },
  {
    id: 'c16',
    label: 'Qualidade final da instalação',
    tooltip:
      'Verificar se não há lixo ou resíduos na porta do cliente nem no caminho até a caixa CTO — a área deve estar limpa após a execução do serviço.',
  },
];

/* ============================================================
   TYPES
   ============================================================ */
type ChecklistValue = 'Sim' | 'Não' | 'N/A' | null;

interface PhotoItem {
  id: string;
  dataUrl: string;
  timestamp: string;
  address: string;
  fromCamera: boolean;
  comentario: string;
}

interface ToastState {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface TooltipState {
  text: string;
  x: number;
  y: number;
}

interface Ratings {
  empresa: number;
  suporte: number;
  tecnico: number;
}

/* ============================================================
   HELPERS
   ============================================================ */
function formatDate(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function addPhotoOverlay(
  dataUrl: string,
  timestamp: string,
  address: string
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const barH = Math.max(56, img.height * 0.09);
      ctx.fillStyle = 'rgba(0,0,0,0.68)';
      ctx.fillRect(0, img.height - barH, img.width, barH);

      const fs = Math.max(14, Math.round(img.width * 0.026));
      ctx.font = `bold ${fs}px monospace`;
      ctx.fillStyle = '#E50012';
      ctx.fillText(timestamp, 12, img.height - barH + fs + 6);

      ctx.font = `${Math.round(fs * 0.82)}px monospace`;
      ctx.fillStyle = '#FFFFFF';
      const addr = address.length > 70 ? address.substring(0, 67) + '...' : address;
      ctx.fillText(addr, 12, img.height - barH + fs * 2 + 10);

      resolve(canvas.toDataURL('image/jpeg', 0.86));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target!.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function FiscalPage() {
  /* ----- visit data ----- */
  const [clientName, setClientName] = useState('');
  const [technicianName, setTechnicianName] = useState('');
  const [fiscalName, setFiscalName] = useState('');
  const [visitDate, setVisitDate] = useState(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  });

  /* ----- GPS ----- */
  const [gpsAddress, setGpsAddress] = useState('Clique para obter localização');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);

  /* ----- checklist ----- */
  const initialChecklist = () => {
    const obj: Record<string, ChecklistValue> = {};
    CHECKLIST_ITEMS.forEach((item) => (obj[item.id] = null));
    return obj;
  };
  const [checklist, setChecklist] = useState<Record<string, ChecklistValue>>(initialChecklist);

  /* ----- observations ----- */
  const [observations, setObservations] = useState('');

  /* ----- photos ----- */
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  /* ----- ratings ----- */
  const [ratingEnabled, setRatingEnabled] = useState(false);
  const [ratings, setRatings] = useState<Ratings>({ empresa: 0, suporte: 0, tecnico: 0 });
  const [hoverRating, setHoverRating] = useState<Ratings>({ empresa: 0, suporte: 0, tecnico: 0 });

  /* ----- signature ----- */
  const [signatureEnabled, setSignatureEnabled] = useState(false);
  const [signatureConfirmed, setSignatureConfirmed] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);

  /* ----- UI states ----- */
  const [toast, setToast] = useState<ToastState | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  /* ----- refs ----- */
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const techListId = 'technicians-list';

  /* ----- dirty tracking ----- */
  useEffect(() => {
    if (clientName || technicianName || fiscalName || observations || photos.length) {
      setIsDirty(true);
    }
  }, [clientName, technicianName, fiscalName, observations, photos.length]);

  /* ----- beforeunload ----- */
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /* ======================== TOAST ======================== */
  const showToast = useCallback((message: string, type: ToastState['type'] = 'info') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3500);
  }, []);

  /* ======================== GPS ======================== */
  const fetchGPS = useCallback(async () => {
    if (!navigator.geolocation) {
      showToast('Geolocalização não suportada neste dispositivo.', 'error');
      return;
    }
    setGpsLoading(true);
    setGpsAddress('Obtendo localização...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsCoords({ lat, lng });
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          );
          const data = await res.json();
          const addr =
            data.display_name ||
            `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setGpsAddress(addr);
          showToast('Localização obtida com sucesso!', 'success');
        } catch {
          setGpsAddress(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        }
        setGpsLoading(false);
      },
      () => {
        setGpsAddress('Não foi possível obter a localização');
        setGpsLoading(false);
        showToast('Erro ao acessar GPS. Verifique as permissões.', 'error');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  }, [showToast]);

  /* ======================== CHECKLIST ======================== */
  const setChecklistValue = (id: string, value: ChecklistValue) => {
    setChecklist((prev) => ({ ...prev, [id]: value }));
    setIsDirty(true);
  };

  const computeScore = () => {
    let sim = 0, nao = 0, na = 0;
    Object.values(checklist).forEach((v) => {
      if (v === 'Sim') sim++;
      else if (v === 'Não') nao++;
      else if (v === 'N/A') na++;
    });
    const applicable = sim + nao;
    const pct = applicable > 0 ? Math.round((sim / applicable) * 100) : 0;
    const level = pct >= 80 ? 'high' : pct >= 60 ? 'mid' : 'low';
    return { sim, nao, na, pct, level };
  };

  const { sim, nao, na, pct, level } = computeScore();

  /* ======================== PHOTOS ======================== */
  const handleCameraCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const remaining = MAX_PHOTOS - photos.length;
      if (remaining <= 0) {
        showToast(`Limite de ${MAX_PHOTOS} fotos atingido.`, 'error');
        return;
      }
      const toProcess = files.slice(0, remaining);
      const timestamp = formatDate(new Date());
      const address = gpsAddress.startsWith('Clique') ? 'Sem localização' : gpsAddress;

      const newPhotos: PhotoItem[] = [];
      for (const file of toProcess) {
        const raw = await readFileAsDataUrl(file);
        const withOverlay = await addPhotoOverlay(raw, timestamp, address);
        newPhotos.push({
          id: `cam_${Date.now()}_${Math.random()}`,
          dataUrl: withOverlay,
          timestamp,
          address,
          fromCamera: true,
          comentario: '',
        });
      }
      setPhotos((prev) => [...prev, ...newPhotos]);
      setIsDirty(true);
      showToast(`${newPhotos.length} foto(s) adicionada(s) com overlay.`, 'success');
      e.target.value = '';
    },
    [photos.length, gpsAddress, showToast]
  );

  const handleGalleryUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      const remaining = MAX_PHOTOS - photos.length;
      if (remaining <= 0) {
        showToast(`Limite de ${MAX_PHOTOS} fotos atingido.`, 'error');
        return;
      }
      const toProcess = files.slice(0, remaining);

      const newPhotos: PhotoItem[] = [];
      for (const file of toProcess) {
        const dataUrl = await readFileAsDataUrl(file);
        newPhotos.push({
          id: `gal_${Date.now()}_${Math.random()}`,
          dataUrl,
          timestamp: formatDate(new Date()),
          address: '',
          fromCamera: false,
          comentario: '',
        });
      }
      setPhotos((prev) => [...prev, ...newPhotos]);
      setIsDirty(true);
      showToast(`${newPhotos.length} foto(s) carregada(s).`, 'success');
      e.target.value = '';
    },
    [photos.length, showToast]
  );

  const deletePhoto = useCallback(
    (id: string) => {
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      if (lightboxIndex !== null) setLightboxIndex(null);
      showToast('Foto removida.', 'info');
    },
    [lightboxIndex, showToast]
  );

  const updatePhotoComment = useCallback((id: string, text: string) => {
    setPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, comentario: text } : p))
    );
  }, []);

  const downloadSinglePhotoPdf = useCallback(
    async (photo: PhotoItem) => {
      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();

      doc.setFillColor(3, 3, 3);
      doc.rect(0, 0, pageW, pageH, 'F');
      doc.setFontSize(10);
      doc.setTextColor(200, 200, 200);
      doc.text('SilverNet Tecnologia — Ficha Fiscal Técnica', pageW / 2, 12, { align: 'center' });
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Foto capturada em: ${photo.timestamp}`, pageW / 2, 18, { align: 'center' });
      if (photo.address) {
        const lines = doc.splitTextToSize(`Local: ${photo.address}`, pageW - 30);
        doc.text(lines, pageW / 2, 23, { align: 'center' });
      }

      const imgY = 30;
      const maxImgH = pageH - imgY - 20;
      const imgW = pageW - 20;
      doc.addImage(photo.dataUrl, 'JPEG', 10, imgY, imgW, maxImgH, undefined, 'FAST');
      doc.save(`foto_${photo.id.substring(0, 12)}.pdf`);
      showToast('PDF da foto gerado!', 'success');
    },
    [showToast]
  );

  /* ======================== SIGNATURE ======================== */
  const getSignaturePos = (
    e: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent,
    canvas: HTMLCanvasElement
  ) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = 'touches' in e && e.touches.length > 0 ? e.touches[0] : (e as MouseEvent);
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  };

  const initSignatureCanvas = useCallback(() => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    // Set intrinsic size to match CSS display size so getSignaturePos scale ratio stays 1:1
    canvas.width = canvas.offsetWidth || 600;
    canvas.height = canvas.offsetHeight || 180;
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#E8E8E8';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  useEffect(() => {
    if (signatureEnabled && !signatureConfirmed) {
      setTimeout(initSignatureCanvas, 50);
    }
  }, [signatureEnabled, signatureConfirmed, initSignatureCanvas]);

  useEffect(() => {
    if (!signatureEnabled || signatureConfirmed) return;
    const handleResize = () => initSignatureCanvas();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [signatureEnabled, signatureConfirmed, initSignatureCanvas]);

  const onSigStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (signatureConfirmed) return;
    e.preventDefault();
    const canvas = signatureCanvasRef.current!;
    isDrawingRef.current = true;
    lastPosRef.current = getSignaturePos(e.nativeEvent, canvas);
  };

  const onSigMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || signatureConfirmed) return;
    e.preventDefault();
    const canvas = signatureCanvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const pos = getSignaturePos(e.nativeEvent, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const onSigEnd = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    setSignatureConfirmed(false);
    setSignatureDataUrl(null);
    setTimeout(initSignatureCanvas, 20);
  };

  const confirmSignature = () => {
    const canvas = signatureCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureDataUrl(dataUrl);
    setSignatureConfirmed(true);
    showToast('Assinatura confirmada!', 'success');
  };

  /* ======================== TOOLTIP ======================== */
  const showTooltip = (e: React.MouseEvent, text: string) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    let x = rect.left + rect.width / 2;
    let y = rect.top - 8;
    if (x > window.innerWidth - 140) x = window.innerWidth - 150;
    if (x < 10) x = 10;
    setTooltip({ text, x, y });
  };

  const hideTooltip = () => setTooltip(null);

  /* ======================== PDF GENERATION ======================== */
  const generatePDF = useCallback(async () => {
    setIsGenerating(true);
    showToast('Gerando PDF...', 'info');
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pW = doc.internal.pageSize.getWidth();
      const pH = doc.internal.pageSize.getHeight();
      const margin = 14;

      const addFooter = (pageNum: number, totalPages: number) => {
        doc.setFontSize(7);
        doc.setTextColor(80, 80, 80);
        doc.text(
          `SilverNet Tecnologia | Ficha Fiscal Técnica | Pág. ${pageNum}/${totalPages}`,
          pW / 2,
          pH - 6,
          { align: 'center' }
        );
        doc.setDrawColor(229, 0, 18);
        doc.setLineWidth(0.3);
        doc.line(margin, pH - 10, pW - margin, pH - 10);
      };

      /* ---- PAGE 1: Cover ---- */
      doc.setFillColor(3, 3, 3);
      doc.rect(0, 0, pW, pH, 'F');

      doc.setFillColor(229, 0, 18);
      doc.rect(0, 0, pW, 3, 'F');

      doc.setFontSize(28);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(232, 232, 232);
      doc.text('SILVERNET', pW / 2, 40, { align: 'center' });
      doc.setTextColor(229, 0, 18);
      doc.text('TECNOLOGIA', pW / 2, 52, { align: 'center' });

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text('FICHA FISCAL TÉCNICA', pW / 2, 63, { align: 'center' });

      doc.setDrawColor(229, 0, 18);
      doc.setLineWidth(0.5);
      doc.line(margin + 20, 68, pW - margin - 20, 68);

      const coverItems = [
        ['Cliente', clientName || '—'],
        ['Técnico', technicianName || '—'],
        ['Fiscal', fiscalName || '—'],
        ['Data', visitDate || '—'],
        ['Localização', gpsAddress],
        ['Conformidade', `${pct}%`],
      ];

      let cy = 80;
      coverItems.forEach(([label, value]) => {
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.setFont('helvetica', 'normal');
        doc.text(label.toUpperCase(), margin, cy);
        doc.setFontSize(10);
        doc.setTextColor(232, 232, 232);
        doc.setFont('helvetica', 'bold');
        const lines = doc.splitTextToSize(value, pW - margin * 2 - 30);
        doc.text(lines, margin, cy + 5);
        cy += 12 + (lines.length - 1) * 5;
      });

      if (gpsCoords) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(60, 60, 60);
        doc.text(
          `GPS: ${gpsCoords.lat.toFixed(6)}, ${gpsCoords.lng.toFixed(6)}`,
          margin,
          cy + 2
        );
      }

      addFooter(1, 1); // updated after all pages added

      /* ---- PAGE 2: Visit Data + Checklist ---- */
      doc.addPage();
      doc.setFillColor(10, 10, 10);
      doc.rect(0, 0, pW, pH, 'F');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(229, 0, 18);
      doc.text('01 — DADOS DA VISITA', margin, 20);

      autoTable(doc, {
        startY: 22,
        margin: { left: margin, right: margin },
        body: [
          ['Cliente', clientName || '—', 'Técnico', technicianName || '—'],
          ['Fiscal', fiscalName || '—', 'Data', visitDate || '—'],
        ],
        styles: {
          fontSize: 15,
          cellPadding: 4,
          fillColor: [26, 26, 26],
          textColor: [232, 232, 232],
          lineColor: [42, 42, 42],
          lineWidth: 0.2,
          overflow: 'linebreak' as const,
        },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [140, 140, 140], cellWidth: 25, fontSize: 10 },
          1: { cellWidth: 60, fontSize: 15 },
          2: { fontStyle: 'bold', textColor: [140, 140, 140], cellWidth: 25, fontSize: 10 },
          3: { cellWidth: 60, fontSize: 15 },
        },
        theme: 'grid',
      });

      const afterVisit = (doc as any).lastAutoTable.finalY + 6;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(229, 0, 18);
      doc.text('02 — CHECKLIST DE CONFORMIDADE', margin, afterVisit);

      const checklistBody = CHECKLIST_ITEMS.map((item, i) => {
        const val = checklist[item.id] ?? '—';
        return [`${String(i + 1).padStart(2, '0')}`, item.label, val];
      });

      autoTable(doc, {
        startY: afterVisit + 4,
        margin: { left: margin, right: margin },
        head: [['#', 'Item', 'Resultado']],
        body: checklistBody,
        styles: {
          fontSize: 8,
          cellPadding: 2,
          fillColor: [17, 17, 17],
          textColor: [220, 220, 220],
          lineColor: [42, 42, 42],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [229, 0, 18],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 20, halign: 'center' },
        },
        didParseCell: (data) => {
          if (data.column.index === 2 && data.section === 'body') {
            if (data.cell.raw === 'Sim') {
              data.cell.styles.textColor = [0, 200, 83];
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.raw === 'Não') {
              data.cell.styles.textColor = [229, 0, 18];
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.raw === 'N/A') {
              data.cell.styles.textColor = [100, 100, 100];
            }
          }
        },
        theme: 'grid',
      });

      const afterChecklist = (doc as any).lastAutoTable.finalY + 5;

      // Score row
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(140, 140, 140);
      doc.text(
        `Conformidade: ${pct}%   |   Sim: ${sim}   Não: ${nao}   N/A: ${na}`,
        margin,
        afterChecklist
      );

      /* ---- PAGE 3: Observations ---- */
      doc.addPage();
      doc.setFillColor(10, 10, 10);
      doc.rect(0, 0, pW, pH, 'F');

      // Safe bottom boundary: footer line is at pH-10, keep content above pH-14
      const BODY_BOT = pH - 14;
      const OBS_LINE_H = 8;

      let y = 16;
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(229, 0, 18);
      doc.text('03 — OBSERVAÇÕES', margin, y);
      y += 8;

      doc.setFontSize(20);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(210, 210, 210);
      const obsLines = doc.splitTextToSize(observations || 'Sem observações registradas.', pW - margin * 2);

      // Issue 1 fix: render each observation line individually, break page when needed
      for (const line of obsLines) {
        if (y + OBS_LINE_H > BODY_BOT) {
          doc.addPage();
          doc.setFillColor(10, 10, 10);
          doc.rect(0, 0, pW, pH, 'F');
          y = 16;
          doc.setFontSize(20);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(210, 210, 210);
        }
        doc.text(line, margin, y);
        y += OBS_LINE_H;
      }
      y += 8;

      // Track y position on the current page (after observations, or after last photo)
      let currentY = y;

      if (photos.length > 0) {
        /* Helper: get natural image dimensions for aspect ratio */
        const getImgDims = (dataUrl: string): Promise<{ w: number; h: number }> =>
          new Promise((res) => {
            const img = new Image();
            img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight });
            img.onerror = () => res({ w: 4, h: 3 });
            img.src = dataUrl;
          });

        for (let i = 0; i < photos.length; i++) {
          const photo = photos[i];

          doc.addPage();
          doc.setFillColor(10, 10, 10);
          doc.rect(0, 0, pW, pH, 'F');

          let py = 16;

          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(229, 0, 18);
          doc.text('04 — REGISTRO FOTOGRÁFICO', margin, py);
          py += 6;

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(100, 100, 100);
          doc.text(
            `Foto ${i + 1} de ${photos.length}${photo.fromCamera ? ' · câmera' : ' · galeria'}`,
            margin,
            py
          );
          py += 6;

          /* Calculate aspect-ratio-correct image height */
          const imgW = pW - margin * 2;
          let aspectRatio = 0.75; // default 4:3
          try {
            const dims = await getImgDims(photo.dataUrl);
            if (dims.w > 0) aspectRatio = dims.h / dims.w;
          } catch { /* use default */ }

          /* Reserve space below image for comment if present */
          const comentario = photo.comentario?.trim() || '';
          const commentLines = comentario
            ? doc.splitTextToSize(comentario, imgW)
            : ([] as string[]);
          const commentH = commentLines.length > 0 ? commentLines.length * 8 + 10 : 0;

          const maxImgH = pH - py - 20 - commentH;
          const imgH = Math.min(imgW * aspectRatio, maxImgH);

          try {
            doc.addImage(photo.dataUrl, 'JPEG', margin, py, imgW, imgH, undefined, 'NONE');
          } catch {
            doc.setFillColor(26, 26, 26);
            doc.rect(margin, py, imgW, imgH, 'F');
            doc.setFontSize(8);
            doc.setTextColor(100, 100, 100);
            doc.text('Imagem não disponível', margin + imgW / 2, py + imgH / 2, { align: 'center' });
          }

          py += imgH + 5;

          /* Comment below photo */
          if (commentLines.length > 0) {
            doc.setFontSize(20);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(200, 200, 200);
            commentLines.forEach((cl: string) => {
              doc.text(cl, margin, py);
              py += 8;
            });
          }

          // Update currentY to reflect position on the last photo's page
          currentY = py;
        }
      }

      /* ---- Ratings: flow after photos if space allows (Issue 2 fix) ---- */
      if (ratingEnabled) {
        // Need ~80mm for title + 3 rating rows; add new page only if not enough room
        const RATINGS_NEEDED = 80;
        if (BODY_BOT - currentY < RATINGS_NEEDED) {
          doc.addPage();
          doc.setFillColor(10, 10, 10);
          doc.rect(0, 0, pW, pH, 'F');
          currentY = 16;
        }

        let ry = currentY;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(229, 0, 18);
        doc.text('05 — AVALIAÇÃO', margin, ry);
        ry += 8;

        const ratingGroups: [string, number][] = [
          ['Empresa', ratings.empresa],
          ['Suporte', ratings.suporte],
          ['Técnico', ratings.tecnico],
        ];

        ratingGroups.forEach(([label, score]) => {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(180, 180, 180);
          doc.text(label, margin, ry);

          const starSize = 5;
          const starGap = 1;
          let sx = margin + 35;
          for (let s = 1; s <= 10; s++) {
            doc.setFontSize(10);
            doc.setTextColor(s <= score ? 255 : 50, s <= score ? 214 : 50, s <= score ? 0 : 50);
            doc.text('★', sx, ry + 0.5);
            sx += starSize + starGap;
          }

          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(229, 0, 18);
          doc.text(`${score}/10`, sx + 2, ry + 0.5);
          ry += 9;
        });

        currentY = ry + 5;
      }

      /* ---- Signature: flow after ratings if space allows (Issue 3 fix) ---- */
      if (signatureDataUrl) {
        const sigW = pW - margin * 2;
        const sigH = sigW * 0.3;
        // title(~6) + date(~6) + image(sigH) + line+name(~14)
        const SIGNATURE_NEEDED = 6 + 6 + sigH + 14;

        if (BODY_BOT - currentY < SIGNATURE_NEEDED) {
          doc.addPage();
          doc.setFillColor(10, 10, 10);
          doc.rect(0, 0, pW, pH, 'F');
          currentY = 16;
        }

        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(229, 0, 18);
        doc.text('06 — ASSINATURA', margin, currentY);
        currentY += 6;

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text(`Assinado digitalmente em: ${formatDate(new Date())}`, margin, currentY);
        currentY += 6;

        doc.addImage(signatureDataUrl, 'PNG', margin, currentY, sigW, sigH);

        doc.setDrawColor(229, 0, 18);
        doc.setLineWidth(0.3);
        doc.line(margin, currentY + sigH + 4, pW - margin, currentY + sigH + 4);

        doc.setFontSize(8);
        doc.setTextColor(160, 160, 160);
        doc.text(clientName || 'Responsável', pW / 2, currentY + sigH + 10, { align: 'center' });
      }

      /* ---- Update footers ---- */
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        addFooter(p, totalPages);
      }

      const dataFormatada = visitDate ? visitDate.split('-').reverse().join('-') : new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const nomeTec = technicianName.replace(/\s+/g, '_') || 'Tecnico';
      const nomeCli = clientName.replace(/\s+/g, '_') || 'Cliente';
      const filename = `${nomeTec}-${nomeCli}-${dataFormatada}.pdf`;

      const blob = doc.output('blob');
      const file = new File([blob], filename, { type: 'application/pdf' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ title: filename, text: filename, files: [file] });
        } catch (e: unknown) {
          if ((e as { name?: string }).name !== 'AbortError') {
            showToast('Compartilhamento cancelado.', 'error');
          }
        }
      } else {
        const desejaBaixar = window.confirm('Seu dispositivo não suporta compartilhamento direto. Deseja baixar o PDF?');
        if (desejaBaixar) {
          doc.save(filename);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao gerar PDF. Tente novamente.', 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [
    clientName, technicianName, fiscalName, visitDate,
    gpsAddress, gpsCoords, checklist, observations, photos,
    ratingEnabled, ratings, signatureDataUrl,
    pct, sim, nao, na, showToast,
  ]);

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className={styles.container}>
      {/* ---------- GPS Bar ---------- */}
      <div className={styles.gpsBar} onClick={fetchGPS} title="Clique para obter localização GPS">
        <i
          className={`fa-solid ${gpsLoading ? 'fa-spinner' : 'fa-location-dot'} ${styles.gpsIcon} ${gpsLoading ? styles.loading : ''}`}
        />
        {!gpsLoading && <span className={styles.gpsPulse} />}
        <span className={styles.gpsText}>{gpsAddress}</span>
        {gpsCoords && (
          <span className={styles.gpsCoords}>
            {gpsCoords.lat.toFixed(4)}, {gpsCoords.lng.toFixed(4)}
          </span>
        )}
      </div>

      {/* ---------- Page Header ---------- */}
      <div className={styles.pageHeader}>
        <div className={styles.logoRow}>
          <span className={styles.logoText}>
            SILVER<span className={styles.logoAccent}>NET</span>
          </span>
          <span className={styles.logoSub}>Tecnologia</span>
        </div>
        <div className={styles.docTitle}>Ficha Fiscal Técnica</div>
      </div>

      {/* ==================== SECTION 01: Visit Data ==================== */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>01/06</span>
          <span className={styles.sectionTitle}>Dados da Visita</span>
          <i className={`fa-solid fa-id-card ${styles.sectionIcon}`} />
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.formGrid}>
            <div className={`${styles.formGroup} ${styles.wide}`}>
              <label className={styles.formLabel}>Nome do Cliente</label>
              <input
                className={styles.formInput}
                type="text"
                placeholder="Nome do cliente ou empresa"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Técnico Responsável</label>
              <input
                className={styles.formInput}
                type="text"
                list={techListId}
                placeholder="Nome do técnico"
                value={technicianName}
                onChange={(e) => setTechnicianName(e.target.value)}
              />
              <datalist id={techListId}>
                {TECHNICIANS.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Fiscal / Inspetor</label>
              <input
                className={styles.formInput}
                type="text"
                placeholder="Nome do fiscal"
                value={fiscalName}
                onChange={(e) => setFiscalName(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Data da Visita</label>
              <input
                className={styles.formInput}
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ==================== SECTION 02: Checklist ==================== */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>02/06</span>
          <span className={styles.sectionTitle}>Checklist de Conformidade</span>
          <i className={`fa-solid fa-list-check ${styles.sectionIcon}`} />
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.checklistItems}>
            {CHECKLIST_ITEMS.map((item, idx) => {
              const val = checklist[item.id];
              let statusClass = '';
              if (val === 'Sim') statusClass = styles.conforming;
              else if (val === 'Não') statusClass = styles.nonConforming;
              else if (val === 'N/A') statusClass = styles.notApplicable;

              return (
                <div key={item.id} className={`${styles.checklistItem} ${statusClass}`}>
                  <span className={styles.checklistNum}>{String(idx + 1).padStart(2, '0')}</span>
                  <span className={styles.checklistLabel}>{item.label}</span>
                  <button
                    className={styles.checklistTooltipBtn}
                    onMouseEnter={(e) => showTooltip(e, item.tooltip)}
                    onMouseLeave={hideTooltip}
                    onClick={(e) => {
                      e.stopPropagation();
                      showTooltip(e, item.tooltip);
                      setTimeout(hideTooltip, 3000);
                    }}
                    aria-label="Info"
                    type="button"
                  >
                    <i className="fa-solid fa-circle-info" />
                  </button>
                  <div className={styles.checklistBtns}>
                    {(['Sim', 'Não', 'N/A'] as ChecklistValue[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={`${styles.btn} ${
                          val === v
                            ? v === 'Sim'
                              ? styles.simActive
                              : v === 'Não'
                              ? styles.naoActive
                              : styles.naActive
                            : ''
                        }`}
                        onClick={() => setChecklistValue(item.id, val === v ? null : v)}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Conformity Score */}
          <div className={styles.scoreWrapper}>
            <div className={styles.scoreRow}>
              <span className={styles.scoreLabel}>Índice de Conformidade</span>
              <span className={`${styles.scoreValue} ${styles[level]}`}>{pct}%</span>
            </div>
            <div className={styles.scoreBar}>
              <div
                className={`${styles.scoreBarFill} ${styles[level]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className={styles.scorePills}>
              <span className={`${styles.pill} ${styles.sim}`}>✓ Sim: {sim}</span>
              <span className={`${styles.pill} ${styles.nao}`}>✗ Não: {nao}</span>
              <span className={`${styles.pill} ${styles.na}`}>N/A: {na}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== SECTION 03: Observations ==================== */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>03/06</span>
          <span className={styles.sectionTitle}>Observações</span>
          <i className={`fa-solid fa-pen-to-square ${styles.sectionIcon}`} />
        </div>
        <div className={styles.sectionBody}>
          <textarea
            className={styles.obsTextarea}
            placeholder="Registre aqui observações, anomalias, recomendações ou detalhes técnicos da visita..."
            maxLength={MAX_CHARS}
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={5}
          />
          <div
            className={`${styles.charCounter} ${
              observations.length >= MAX_CHARS
                ? styles.limit
                : observations.length >= MAX_CHARS * 0.85
                ? styles.warn
                : ''
            }`}
          >
            {observations.length} / {MAX_CHARS}
          </div>
        </div>
      </div>

      {/* ==================== SECTION 04: Photos ==================== */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>04/06</span>
          <span className={styles.sectionTitle}>Registro Fotográfico</span>
          <i className={`fa-solid fa-camera ${styles.sectionIcon}`} />
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.photoActions}>
            <button
              className={styles.photoBtnPrimary}
              type="button"
              disabled={photos.length >= MAX_PHOTOS}
              onClick={() => cameraInputRef.current?.click()}
            >
              <i className="fa-solid fa-camera" />
              Capturar Foto
            </button>
            <button
              className={styles.photoBtnSecondary}
              type="button"
              disabled={photos.length >= MAX_PHOTOS}
              onClick={() => galleryInputRef.current?.click()}
            >
              <i className="fa-solid fa-images" />
              Galeria
            </button>
            <span className={styles.photoCount}>
              {photos.length} / {MAX_PHOTOS}
            </span>
          </div>

          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            style={{ display: 'none' }}
            onChange={handleCameraCapture}
          />
          <input
            ref={galleryInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleGalleryUpload}
          />

          {photos.length === 0 ? (
            <div className={styles.emptyPhotos}>
              <i className="fa-regular fa-image" style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
              Nenhuma foto adicionada. Capture ou importe da galeria.
            </div>
          ) : (
          <div className={styles.photoGrid}>
              {photos.map((photo, idx) => (
                <div key={photo.id} className={styles.photoItem}>
                  <div
                    className={styles.photoThumb}
                    onClick={() => setLightboxIndex(idx)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.dataUrl} alt={`Foto ${idx + 1}`} />
                    {photo.fromCamera && (
                      <span className={styles.photoCameraTag}>
                        <i className="fa-solid fa-camera" /> CAM
                      </span>
                    )}
                    <div className={styles.photoOverlay} onClick={(e) => e.stopPropagation()}>
                      <button
                        className={styles.photoOverlayBtn}
                        type="button"
                        title="Visualizar"
                        onClick={() => setLightboxIndex(idx)}
                      >
                        <i className="fa-solid fa-magnifying-glass" />
                      </button>
                      <button
                        className={styles.photoOverlayBtn}
                        type="button"
                        title="Download PDF"
                        onClick={() => downloadSinglePhotoPdf(photo)}
                      >
                        <i className="fa-solid fa-file-pdf" />
                      </button>
                      <button
                        className={styles.photoOverlayBtn}
                        type="button"
                        title="Excluir"
                        onClick={() => deletePhoto(photo.id)}
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </div>
                  <textarea
                    className={styles.photoCommentInput}
                    placeholder="Comentário / observação..."
                    value={photo.comentario}
                    onChange={(e) => updatePhotoComment(photo.id, e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    rows={2}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==================== SECTION 05: Ratings ==================== */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>05/06</span>
          <span className={styles.sectionTitle}>Avaliação</span>
          <i className={`fa-solid fa-star ${styles.sectionIcon}`} />
        </div>
        <div className={styles.sectionBody}>
          {!ratingEnabled ? (
            <div className={styles.ratingActivate}>
              <p>A avaliação é opcional. Ative para registrar a pontuação de desempenho.</p>
              <button
                className={styles.btnActivate}
                type="button"
                onClick={() => setRatingEnabled(true)}
              >
                <i className="fa-solid fa-star" />
                Ativar Avaliação
              </button>
            </div>
          ) : (
            <div className={styles.ratingGroups}>
              {(
                [
                  { key: 'empresa', label: 'Empresa' },
                  { key: 'suporte', label: 'Suporte' },
                  { key: 'tecnico', label: 'Técnico' },
                ] as { key: keyof Ratings; label: string }[]
              ).map(({ key, label }) => (
                <div key={key} className={styles.ratingGroup}>
                  <div className={styles.ratingGroupTitle}>{label}</div>
                  <div className={styles.stars}>
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((star) => (
                      <span
                        key={star}
                        className={`${styles.star} ${
                          star <= (hoverRating[key] || ratings[key]) ? styles.filled : ''
                        } ${hoverRating[key] > 0 && star <= hoverRating[key] ? styles.hover : ''}`}
                        onMouseEnter={() =>
                          setHoverRating((prev) => ({ ...prev, [key]: star }))
                        }
                        onMouseLeave={() =>
                          setHoverRating((prev) => ({ ...prev, [key]: 0 }))
                        }
                        onClick={() => {
                          setRatings((prev) => ({ ...prev, [key]: star }));
                          setIsDirty(true);
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${star} estrelas`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            setRatings((prev) => ({ ...prev, [key]: star }));
                          }
                        }}
                      >
                        ★
                      </span>
                    ))}
                  </div>
                  <div className={styles.ratingVal}>
                    {ratings[key] > 0 ? (
                      <>
                        Nota: <span>{ratings[key]}</span>/10
                      </>
                    ) : (
                      'Sem avaliação'
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==================== SECTION 06: Signature ==================== */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionBadge}>06/06</span>
          <span className={styles.sectionTitle}>Assinatura Digital</span>
          <i className={`fa-solid fa-signature ${styles.sectionIcon}`} />
        </div>
        <div className={styles.sectionBody}>
          {!ratingEnabled ? (
            <div className={styles.signatureActivate}>
              <p>Ative a avaliação (seção 05) para habilitar a assinatura.</p>
            </div>
          ) : !signatureEnabled ? (
            <div className={styles.signatureActivate}>
              <p>Ative a assinatura digital do responsável para finalizar a ficha.</p>
              <button
                className={styles.btnActivate}
                type="button"
                onClick={() => setSignatureEnabled(true)}
              >
                <i className="fa-solid fa-pen-nib" />
                Ativar Assinatura
              </button>
            </div>
          ) : (
            <div className={styles.signatureWrapper}>
              <canvas
                ref={signatureCanvasRef}
                className={`${styles.signatureCanvas} ${signatureConfirmed ? styles.confirmed : ''}`}
                onMouseDown={onSigStart}
                onMouseMove={onSigMove}
                onMouseUp={onSigEnd}
                onMouseLeave={onSigEnd}
                onTouchStart={onSigStart}
                onTouchMove={onSigMove}
                onTouchEnd={onSigEnd}
              />
              <div className={styles.signatureBtns}>
                {!signatureConfirmed ? (
                  <>
                    <button className={styles.btnClear} type="button" onClick={clearSignature}>
                      <i className="fa-solid fa-rotate-left" /> Limpar
                    </button>
                    <button className={styles.btnConfirm} type="button" onClick={confirmSignature}>
                      <i className="fa-solid fa-check" /> Confirmar Assinatura
                    </button>
                  </>
                ) : (
                  <>
                    <span className={styles.signatureConfirmedBadge}>
                      <i className="fa-solid fa-circle-check" /> Assinatura Confirmada
                    </span>
                    <button className={styles.btnClear} type="button" onClick={clearSignature}>
                      <i className="fa-solid fa-rotate-left" /> Refazer
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ==================== Generate PDF ==================== */}
      <div className={styles.pdfSection}>
        <button
          className={styles.btnPdf}
          type="button"
          onClick={generatePDF}
          disabled={isGenerating}
        >
          <i className={`fa-solid ${isGenerating ? 'fa-spinner fa-spin' : 'fa-file-export'}`} />
          {isGenerating ? 'Gerando PDF...' : 'Gerar & Compartilhar PDF'}
        </button>
      </div>

      {/* ---------- Toast ---------- */}
      {toast && (
        <div className={`${styles.toast} ${styles[toast.type]}`}>
          <i
            className={`fa-solid ${
              toast.type === 'success'
                ? 'fa-circle-check'
                : toast.type === 'error'
                ? 'fa-circle-xmark'
                : 'fa-circle-info'
            }`}
          />
          {toast.message}
        </div>
      )}

      {/* ---------- Tooltip ---------- */}
      {tooltip && (
        <div
          className={styles.tooltip}
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* ---------- Lightbox ---------- */}
      {lightboxIndex !== null && photos[lightboxIndex] && (
        <div
          className={styles.lightboxOverlay}
          onClick={() => setLightboxIndex(null)}
        >
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button
              className={styles.lightboxClose}
              type="button"
              onClick={() => setLightboxIndex(null)}
            >
              <i className="fa-solid fa-xmark" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.lightboxImg}
              src={photos[lightboxIndex].dataUrl}
              alt={`Foto ${lightboxIndex + 1}`}
            />
            <div className={styles.lightboxNav}>
              <button
                className={styles.lightboxNavBtn}
                type="button"
                disabled={lightboxIndex === 0}
                onClick={() => setLightboxIndex((i) => (i !== null ? i - 1 : null))}
              >
                <i className="fa-solid fa-chevron-left" /> Anterior
              </button>
              <span className={styles.lightboxIndex}>
                {lightboxIndex + 1} / {photos.length}
              </span>
              <button
                className={styles.lightboxNavBtn}
                type="button"
                disabled={lightboxIndex === photos.length - 1}
                onClick={() => setLightboxIndex((i) => (i !== null ? i + 1 : null))}
              >
                Próxima <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
