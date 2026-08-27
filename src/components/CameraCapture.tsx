/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, RefreshCw, Upload, X, Check, FlipHorizontal, AlertCircle, Sparkles } from 'lucide-react';

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  onCancel: () => void;
  title?: string;
  subTitle?: string;
}

export default function CameraCapture({
  onCapture,
  onCancel,
  title = "Captura de Foto Biométrica",
  subTitle = "Sua foto de assinatura facial será usada para liberação rápida no refeitório"
}: CameraCaptureProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Start the video stream
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function startVideo() {
      setIsLoading(true);
      setErrorMsg(null);
      
      // Stop existing stream first
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }

      try {
        const constraints = {
          video: {
            facingMode: facingMode,
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
          audio: false
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = mediaStream;
        setStream(mediaStream);
        setHasCamera(true);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(e => {
            console.error("error playing video stream:", e);
          });
        }
      } catch (err: any) {
        console.warn("Navegador ou Iframe bloqueou getUserMedia, usando fallback nativo:", err);
        setHasCamera(false);
        // Fallback info
        let friendlyError = "Não foi possível abrir a câmera nativa do navegador (pode estar restrito em prévia ou sem permissão).";
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          friendlyError = "Permissão de acesso à câmera negada. Conceda permissão ou use o botão de fallback abaixo para tirar foto.";
        }
        setErrorMsg(friendlyError);
      } finally {
        setIsLoading(false);
      }
    }

    if (!capturedImage) {
      startVideo();
    }

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [facingMode, capturedImage]);

  // Handle native file camera input fallback
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setCapturedImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Switch camera toggle (user facing vs environment)
  const toggleCamera = () => {
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  // Capture current stream frame
  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Set canvas to watch video size (prefer 500x500 square for facial biometrics)
        const size = Math.min(video.videoWidth, video.videoHeight) || 480;
        canvas.width = size;
        canvas.height = size;

        // Calculate square crop from center
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;

        // If front camera (user), mirror the canvas render
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }

        ctx.drawImage(
          video,
          sx,
          sy,
          size,
          size,
          0,
          0,
          size,
          size
        );

        // Reset transform
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        // Convert to dataUrl base64 jpeg
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setCapturedImage(dataUrl);

        // Stop stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
      }
    }
  };

  // Trigger manual select/take foto with phone native camera app
  const triggerNativeCamera = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleConfirm = () => {
    if (capturedImage) {
      onCapture(capturedImage);
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-neutral-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in" id="camera-capture-lightbox">
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-2xl max-w-md w-full overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header decoration */}
        <div className="bg-neutral-900 text-white p-4 shrink-0 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-emerald-400" />
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-neutral-400">Capturar Face</h3>
              <p className="text-sm font-bold truncate max-w-[260px]">{title}</p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onCancel}
            className="p-1 px-2.5 bg-neutral-800 text-neutral-300 hover:text-white rounded-lg transition active:scale-95 text-xs font-extrabold"
          >
            ✕ Fechar
          </button>
        </div>

        {/* Info label banner */}
        <div className="bg-emerald-50 text-emerald-850 px-4 py-2.5 text-[10px] sm:text-xs leading-normal font-semibold border-b border-emerald-100 shrink-0">
          {subTitle}
        </div>

        {/* Content Viewport */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto flex flex-col justify-center items-center min-h-[300px]">
          
          {/* Hidden Canvas and Fallback Input */}
          <canvas ref={canvasRef} className="hidden" />
          <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            capture="user" 
            className="hidden" 
            onChange={handleFileChange}
            id="camera-native-fallback-input"
          />

          {!capturedImage ? (
            /* ACTIVE CAMERA STREAM VIEW OR RETRY */
            <div className="w-full flex flex-col items-center space-y-4">
              
              {/* Camera Frame/Container */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 border-neutral-200 bg-neutral-900 overflow-hidden shadow-inner flex items-center justify-center">
                {isLoading ? (
                  <div className="text-center text-neutral-400 text-xs flex flex-col items-center gap-2">
                    <RefreshCw className="h-8 w-8 animate-spin text-emerald-500" />
                    <span>Iniciando câmera...</span>
                  </div>
                ) : hasCamera ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
                  />
                ) : (
                  <div className="text-center p-4 space-y-3">
                    <div className="p-3 bg-neutral-850 text-neutral-400 rounded-full inline-block">
                      <Camera className="h-10 w-10 text-neutral-500" />
                    </div>
                    <p className="text-[11px] font-bold text-neutral-400">Canal de Câmera Bloqueado</p>
                  </div>
                )}

                {/* Facial overlay guidelines ring */}
                {hasCamera && !isLoading && (
                  <div className="absolute inset-4 rounded-full border border-dashed border-emerald-500/50 pointer-events-none flex items-center justify-center">
                    <div className="w-4/5 h-4/5 rounded-full border border-dashed border-emerald-500/20" />
                  </div>
                )}
              </div>

              {/* Status and Error indicators */}
              {errorMsg && (
                <div className="max-w-xs bg-amber-50 rounded-lg p-2.5 border border-amber-200 text-amber-900 text-[10px] leading-normal flex items-start gap-1.5 font-medium">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Aviso: </span>
                    {errorMsg}
                  </div>
                </div>
              )}

              {/* Interaction Controls */}
              <div className="w-full flex flex-col items-center gap-3 pt-2">
                {hasCamera && !isLoading ? (
                  /* WEBCAM IS ACTIVE CONTROLS */
                  <div className="flex items-center gap-3 w-full justify-center">
                    <button
                      type="button"
                      onClick={toggleCamera}
                      className="p-3 bg-neutral-100 hover:bg-neutral-250 text-neutral-700 rounded-xl border border-neutral-200 transition duration-150 active:scale-90 flex items-center justify-center gap-1.5 touch-target text-xs font-bold shrink-0 shadow-xs"
                      title="Alternar Câmera"
                    >
                      <FlipHorizontal className="h-4.5 w-4.5 text-neutral-600" />
                      Girar ({facingMode === 'user' ? 'Frontal' : 'Traseira'})
                    </button>

                    <button
                      type="button"
                      onClick={takePhoto}
                      className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold rounded-xl transition flex items-center justify-center gap-1.5 touch-target shadow-md"
                    >
                      <Camera className="h-5 w-5" /> Registrar Foto 📸
                    </button>
                  </div>
                ) : (
                  /* CAMERA ERROR / IFRAME BLOCK FALLBACK OPTIONS (PERFECT FOR PHONES) */
                  <div className="space-y-2 w-full text-center">
                    <button
                      type="button"
                      onClick={triggerNativeCamera}
                      className="w-full px-5 py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-xl transition duration-150 flex items-center justify-center gap-2 touch-target shadow-lg"
                    >
                      <Camera className="h-5 w-5" /> Abrir Câmera do Celular / Tablet 🤳
                    </button>
                    <p className="text-[10px] text-neutral-400 font-medium">
                      Recomendado para celulares e tablets: O sistema solicitará a câmera nativa do seu aparelho para tirar uma selfie de alta qualidade 100% livre de bloqueios.
                    </p>
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* PREVIEW OF THE CAPTURED PHOTO VIEW */
            <div className="w-full flex flex-col items-center space-y-4">
              <span className="text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Foto Capturada com Sucesso
              </span>

              {/* Photo Preview Frame */}
              <div className="relative w-64 h-64 sm:w-72 sm:h-72 rounded-full border-4 border-emerald-500 bg-neutral-100 overflow-hidden shadow-md flex items-center justify-center">
                <img 
                  src={capturedImage} 
                  alt="Captured face preview" 
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Actions confirmation */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl border border-neutral-300 font-extrabold text-xs transition active:scale-95 touch-target"
                >
                  Tirar Outra 🔄
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs transition active:scale-95 flex items-center justify-center gap-1.5 touch-target shadow-md"
                >
                  <Check className="h-4.5 w-4.5 font-bold" /> Confirmar Foto
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
