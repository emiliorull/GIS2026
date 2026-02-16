
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
interface Question {
  pregunta_id: string | number;
  bloque: string;
  enunciado: string;
  opciones: {
    a: string;
    b: string;
    c: string;
    d: string;
  };
  respuesta_correcta: 'a' | 'b' | 'c' | 'd';
  justificacion: string;
  dificultad: 'baja' | 'media' | 'alta';
}

type AppStep = 'setup' | 'loading' | 'testing' | 'results';

const BLOCKS = [
  { id: 'BL1', name: 'Bloque I: Organización del Estado y Administración electrónica' },
  { id: 'BL2', name: 'Bloque II: Tecnología básica' },
  { id: 'BL3', name: 'Bloque III: Desarrollo de sistemas' },
  { id: 'BL4', name: 'Bloque IV: Sistemas y comunicaciones' },
  { id: 'MOCK', name: 'Simulacro Completo (100 Preguntas - 90 min)' }
];

const MOCK_TIME = 90 * 60; // 90 minutos en segundos

// --- Components ---

const App = () => {
  const [step, setStep] = useState<AppStep>('setup');
  const [selectedBlock, setSelectedBlock] = useState('MOCK');
  const [questionCount, setQuestionCount] = useState(20);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string | null>>({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  
  // Temporizador
  const [timeLeft, setTimeLeft] = useState(MOCK_TIME);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Asegurar que si es MOCK, el contador sea 100 siempre
  useEffect(() => {
    if (selectedBlock === 'MOCK') {
      setQuestionCount(100);
    }
  }, [selectedBlock]);

  // Efecto para el temporizador
  useEffect(() => {
    if (step === 'testing' && selectedBlock === 'MOCK' && isTimerActive && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setStep('results');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step, selectedBlock, isTimerActive]);

  // Reinicio completo
  const resetApp = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setStep('setup');
    setCurrentIndex(0);
    setUserAnswers({});
    setShowFeedback(false);
    setQuestions([]);
    setIsGenerating(false);
    setLoadingMessage('');
    setTimeLeft(MOCK_TIME);
    setIsTimerActive(false);
  };

  const handleRestart = () => {
    const confirmRestart = window.confirm('¿Deseas reiniciar el cuestionario? Volverás a la pantalla de inicio y se perderá el progreso actual.');
    if (confirmRestart) {
      resetApp();
    }
  };

  const generateQuestions = async () => {
    setStep('loading');
    setIsGenerating(true);
    setLoadingMessage('Generando examen con el temario oficial GSI 2026...');

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

    const systemInstruction = `
      Eres un preparador experto de la oposición de Gestión de Sistemas e Informática (A2) de la AGE. 
      Debes generar preguntas con el rigor de la CPS (Comisión Permanente de Selección).

      REFERENCIAS DE ESTILO Y CONTENIDO:
      - Utiliza como base el estilo de exámenes de https://forjatic.es/2025/09/11/analisis-de-la-aplicacion-testic/
      - Consulta normativa y criterios técnicos de:
        * https://pmoreno-rodriguez.github.io/opos_gsi/#/
        * https://www.ccn-cert.cni.es/es/ (Guías CCN-STIC)
        * https://ens.ccn-cert.cni.es/es/ (Esquema Nacional de Seguridad 2022)
        * https://administracionelectronica.gob.es/ctt/solucionesCTT.htm
        * https://gobernanza.ccn-cert.cni.es/ens-navegable

      DETALLE DEL TEMARIO:
      - BLOQUE I: Constitución (1978), Cortes, Gobierno, Transparencia (Ley 19/2013), Igualdad/LGTBI, Agenda Digital, eIDAS, Protección de Datos (RGPD/LOPDGDD), LPAC (39/2015), LRJSP (40/2015), TREBEP, ENS, ENI.
      - BLOQUE II: Arquitecturas (Móvil a Supercomputación), Cloud, SO (Windows, Linux, Móvil), Lenguajes y paradigmas, BI (OLTP/OLAP), SQL/ANSI-SPARC, Microservicios/Contenedores, OSI/TCP-IP, HTML/XML/Scripting, Riesgos (Magerit), Auditoría, CRM/IVR, Ciberseguridad/Forense, Licencias, Gestión Proyectos, CMS/SEO.
      - BLOQUE III: Ciclo de vida, Metodologías ágiles, Requisitos, Modelado Datos (Relacional, Normalización), IA, DevOps (CI/CD), Testing, Mantenimiento, UML/Patrones, Java/Jakarta EE, .NET, Web Front/Back, Calidad (Métricas), Accesibilidad (WCAG/UX), Minería/Big Data (Hadoop/NoSQL).
      - BLOQUE IV: Admin SO y BD, Backup/Recuperación, Configuración (ITIL), Almacenamiento (SAN/NAS/Virtualización), CPD (Alta Disponibilidad/BCDR), Medios Transmisión, LAN (Seguridad/Normativa), Gestión Red (SNMP), WAN (MPLS/SD-WAN), Wireless, Seguridad Perimetral/VPN, Internet/IoT, NGN/VoIP, Telefonía Móvil (MDM), Videoconferencia.

      NORMAS CRÍTICAS:
      1. CANTIDAD: Si el usuario pide un Simulacro (MOCK), DEBES GENERAR EXACTAMENTE 100 PREGUNTAS. NI UNA MÁS, NI UNA MENOS.
      2. ALEATORIEDAD DE RESPUESTA: Debes distribuir equitativamente la respuesta correcta entre 'a', 'b', 'c' y 'd'. Evita cualquier sesgo (No abuses de la opción 'b').
      3. PRECISIÓN: Preguntas de nivel A2, conceptuales y de aplicación técnica/normativa.
      4. JUSTIFICACIÓN: Incluye siempre por qué la respuesta es correcta citando la ley o estándar (p.ej. "Según el Art. 13 del ENS...").
      5. FORMATO: JSON estricto.
    `;

    // Si es Simulacro, forzamos siempre 100 preguntas
    const count = selectedBlock === 'MOCK' ? 100 : questionCount; 
    let prompt = `Genera ${count} preguntas de examen tipo test para el ${selectedBlock} siguiendo estrictamente el temario oficial.`;
    if (selectedBlock === 'MOCK') {
      prompt = `ACTÚA COMO TRIBUNAL: Genera un SIMULACRO OFICIAL COMPLETO de EXACTAMENTE ${count} PREGUNTAS respetando la proporción oficial: Bloque I (~15%), Bloque II (~25%), Bloque III (~30%), Bloque IV (~30%). No te detengas hasta completar las 100 preguntas.`;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          // Aumentamos el presupuesto para asegurar que quepan las 100 preguntas
          maxOutputTokens: 30000, 
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pregunta_id: { type: Type.STRING },
                bloque: { type: Type.STRING },
                enunciado: { type: Type.STRING },
                opciones: {
                  type: Type.OBJECT,
                  properties: {
                    a: { type: Type.STRING },
                    b: { type: Type.STRING },
                    c: { type: Type.STRING },
                    d: { type: Type.STRING }
                  },
                  required: ['a', 'b', 'c', 'd']
                },
                respuesta_correcta: { type: Type.STRING },
                justificacion: { type: Type.STRING },
                dificultad: { type: Type.STRING }
              },
              required: ['pregunta_id', 'bloque', 'enunciado', 'opciones', 'respuesta_correcta', 'justificacion', 'dificultad']
            }
          }
        }
      });

      const data = JSON.parse(response.text);
      setQuestions(data);
      setStep('testing');
      if (selectedBlock === 'MOCK') {
        setTimeLeft(MOCK_TIME);
        setIsTimerActive(false); // Esperar a que el usuario lo inicie
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error en la generación. Verifica tu conexión e inténtalo de nuevo. Nota: Generar 100 preguntas requiere una respuesta muy larga de la IA.');
      setStep('setup');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (option: string | null) => {
    if (selectedBlock === 'MOCK' && !isTimerActive) return;
    setUserAnswers(prev => ({ ...prev, [currentIndex]: option }));
    const isCorrect = option === questions[currentIndex].respuesta_correcta;
    if (!isCorrect || option === null) {
      setShowFeedback(true);
    } else {
      handleNext();
    }
  };

  const handleNext = () => {
    setShowFeedback(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setStep('results');
    }
  };

  const calculateScore = () => {
    let correct = 0, incorrect = 0, skipped = 0;
    questions.forEach((q, idx) => {
      const ans = userAnswers[idx];
      if (ans === null || ans === undefined) skipped++;
      else if (ans === q.respuesta_correcta) correct++;
      else incorrect++;
    });
    const finalScore = correct - (incorrect * (1/3));
    return { correct, incorrect, skipped, finalScore };
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderSetup = () => (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-xl material-card animate-fadeIn">
      <h1 className="text-3xl font-bold text-indigo-700 mb-6 flex items-center">
        <span className="mr-3">📚</span> GSI 2026: Preparador Oficial
      </h1>
      <p className="text-gray-600 mb-8">Tests actualizados con la normativa vigente (ENS 2022, LPAC, eIDAS, etc.) y fuentes de referencia del sector.</p>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Área de estudio</label>
          <select 
            value={selectedBlock}
            onChange={(e) => setSelectedBlock(e.target.value)}
            className="w-full p-4 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none bg-gray-50 text-gray-900 font-bold appearance-none"
          >
            {BLOCKS.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
          {selectedBlock === 'MOCK' && (
            <div className="mt-3 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-xl">
              <p className="text-xs font-black text-amber-700 uppercase tracking-widest flex items-center mb-1">
                <span className="mr-1">⚠️</span> Reglas del Simulacro:
              </p>
              <ul className="text-[11px] text-amber-800 list-disc list-inside space-y-1 font-bold">
                <li>Extensión fija: 100 preguntas obligatorias.</li>
                <li>Tiempo: 90 minutos (sin pausa).</li>
                <li>El cronómetro se inicia al ver la primera pregunta tras tu confirmación.</li>
              </ul>
            </div>
          )}
        </div>

        {selectedBlock !== 'MOCK' && (
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">Extensión del examen</label>
            <div className="grid grid-cols-4 gap-3">
              {[10, 20, 50, 100].map(n => (
                <button
                  key={n}
                  onClick={() => setQuestionCount(n)}
                  className={`py-3 rounded-xl border-2 transition-all font-black ${questionCount === n ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-500 border-gray-100 hover:border-indigo-200 hover:bg-gray-50'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={generateQuestions}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 px-6 rounded-2xl shadow-xl transform transition active:scale-[0.98] mt-4 text-lg"
        >
          {selectedBlock === 'MOCK' ? 'GENERAR SIMULACRO (100 PREG.)' : 'INICIAR TEST GSI 2026'}
        </button>
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="max-w-2xl mx-auto mt-24 text-center animate-fadeIn">
      <div className="relative inline-block mb-8">
        <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-indigo-600"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-black text-indigo-600">GSI</div>
      </div>
      <h2 className="text-2xl font-black text-gray-800 mb-3">{loadingMessage}</h2>
      <p className="text-gray-500 max-w-sm mx-auto">Preparar 100 preguntas requiere un procesamiento intenso. Por favor, mantén la pestaña abierta mientras el tribunal redacta el examen...</p>
    </div>
  );

  const renderTesting = () => {
    const question = questions[currentIndex];
    if (!question) return null;

    // Pantalla de inicio manual para el simulacro
    if (selectedBlock === 'MOCK' && !isTimerActive) {
      return (
        <div className="max-w-3xl mx-auto mt-20 animate-fadeIn">
           <div className="bg-white rounded-3xl p-12 text-center material-card border-4 border-amber-400 shadow-2xl">
              <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-8 text-5xl animate-bounce">
                ⏱️
              </div>
              <h3 className="text-4xl font-black text-gray-900 mb-6 tracking-tight">¡Examen Preparado!</h3>
              <p className="text-gray-600 mb-10 text-xl font-medium leading-relaxed">
                Hemos generado <span className="text-indigo-600 font-black">{questions.length} preguntas</span> oficiales. <br/>
                Dispones de <span className="text-indigo-600 font-black">90 minutos</span> para completar el simulacro. <br/>
                <span className="text-amber-600 font-black">El tiempo empezará en cuanto confirmes.</span>
              </p>
              <button 
                onClick={() => setIsTimerActive(true)}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-black py-6 px-10 rounded-2xl text-2xl shadow-xl transform transition hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4"
              >
                <span>🚀</span> INICIAR CRONÓMETRO Y COMENZAR
              </button>
              <button 
                onClick={handleRestart}
                className="mt-6 text-gray-400 hover:text-red-500 font-black text-sm uppercase tracking-widest"
              >
                Cancelar y volver
              </button>
           </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto mt-4 p-4 animate-fadeIn">
        <div className="flex justify-between items-center mb-6">
          <button 
            type="button"
            onClick={handleRestart}
            className="group flex items-center text-xs font-black text-gray-400 hover:text-red-600 transition-colors uppercase tracking-widest"
          >
            <span className="mr-2 text-base">✕</span> Abandonar Examen
          </button>
          
          <div className="flex items-center gap-4">
            {selectedBlock === 'MOCK' && (
              <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-black text-lg transition-all ${
                timeLeft < 300 ? 'bg-red-50 border-red-500 text-red-600 animate-pulse' : 'bg-indigo-600 border-indigo-600 text-white'
              }`}>
                <span className="text-xl">⏱️</span> {formatTime(timeLeft)}
              </div>
            )}
            <div className="text-xs font-black text-indigo-600 bg-indigo-50 px-4 py-2 rounded-lg border-2 border-indigo-100 uppercase tracking-widest">
              {question.bloque}
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between text-[10px] text-gray-400 mb-2 uppercase font-black tracking-widest">
            <span>Pregunta {currentIndex + 1} / {questions.length}</span>
            <span>Progreso: {Math.round(((currentIndex + 1) / questions.length) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
            <div 
              className="bg-indigo-600 h-full transition-all duration-700 ease-out" 
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-8 material-card relative border-2 border-gray-50">
          <div className={`absolute -top-3 right-8 px-4 py-1 text-[10px] font-black uppercase rounded-lg shadow-md ${
            question.dificultad === 'alta' ? 'bg-red-600 text-white' : 
            question.dificultad === 'media' ? 'bg-amber-500 text-white' : 'bg-emerald-500 text-white'
          }`}>
            Nivel {question.dificultad}
          </div>

          <h3 className="text-2xl font-bold text-gray-800 mb-10 leading-snug">
            {question.enunciado}
          </h3>

          <div className="grid grid-cols-1 gap-4">
            {Object.entries(question.opciones).map(([key, text]) => (
              <button
                key={key}
                disabled={showFeedback}
                onClick={() => handleAnswer(key)}
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all flex items-center group ${
                  showFeedback && key === question.respuesta_correcta 
                    ? 'bg-emerald-50 border-emerald-500 ring-4 ring-emerald-50' 
                    : showFeedback && userAnswers[currentIndex] === key && key !== question.respuesta_correcta
                    ? 'bg-red-50 border-red-500'
                    : 'bg-white border-gray-100 hover:border-indigo-400 hover:shadow-lg'
                } ${showFeedback ? 'cursor-default' : 'cursor-pointer transform hover:-translate-y-1'}`}
              >
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center mr-5 text-base font-black flex-shrink-0 transition-all ${
                   showFeedback && key === question.respuesta_correcta 
                    ? 'bg-emerald-500 text-white' 
                    : showFeedback && userAnswers[currentIndex] === key 
                      ? 'bg-red-500 text-white' 
                      : 'bg-gray-100 text-gray-400 group-hover:bg-indigo-600 group-hover:text-white'
                }`}>
                  {key.toUpperCase()}
                </span>
                <span className="text-gray-700 font-bold text-lg">{text}</span>
              </button>
            ))}
          </div>

          {!showFeedback && (
            <div className="mt-10 pt-8 border-t-2 border-gray-50 flex justify-center">
              <button 
                onClick={() => handleAnswer(null)}
                className="text-gray-400 hover:text-indigo-600 font-black text-xs tracking-widest uppercase transition-all flex items-center"
              >
                <span className="mr-2">⚪</span> Dejar en blanco / Saltar
              </button>
            </div>
          )}

          {showFeedback && (
            <div className="mt-10 animate-slideUp">
              <div className={`p-6 rounded-2xl mb-8 border-l-8 ${userAnswers[currentIndex] === null ? 'bg-blue-50 border-blue-500 text-blue-900' : 'bg-red-50 border-red-500 text-red-900'}`}>
                <h4 className="font-black text-xs uppercase tracking-widest mb-3 flex items-center">
                   <span className="mr-2">💡</span> Justificación técnica
                </h4>
                <p className="text-lg leading-relaxed font-medium">{question.justificacion}</p>
              </div>
              <button
                onClick={handleNext}
                className="w-full bg-gray-900 hover:bg-black text-white font-black py-5 px-6 rounded-2xl shadow-xl transition-all transform hover:scale-[1.01] active:scale-95 text-lg"
              >
                {currentIndex < questions.length - 1 ? 'SIGUIENTE PREGUNTA' : 'FINALIZAR Y EVALUAR'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderResults = () => {
    const { correct, incorrect, skipped, finalScore } = calculateScore();
    const maxScore = questions.length;
    const normalizedScore = (finalScore * 100 / maxScore);

    return (
      <div className="max-w-3xl mx-auto mt-12 p-12 bg-white rounded-3xl material-card text-center animate-fadeIn border-2 border-gray-50">
        <h2 className="text-4xl font-black text-gray-900 mb-2 uppercase tracking-tight">Resultado del Examen</h2>
        <p className="text-gray-400 font-bold mb-10 tracking-widest uppercase text-xs">
          {selectedBlock === 'MOCK' ? `Simulacro Oficial ${questions.length} Preguntas (Finalizado)` : 'Simulación GSI convocatoria 2026'}
        </p>
        
        <div className="inline-flex flex-col items-center mb-12 p-8 bg-gray-50 rounded-3xl border-2 border-gray-100 shadow-inner">
          <div className="text-8xl font-black text-indigo-600 leading-none mb-4">
            {finalScore.toFixed(2)}
          </div>
          <div className="text-gray-400 font-black uppercase text-sm tracking-widest">Puntuación Final (Netos)</div>
          <div className="mt-8 px-8 py-4 bg-white text-indigo-700 rounded-2xl font-black text-3xl border-2 border-indigo-100 shadow-sm">
            {normalizedScore.toFixed(2)} / 100
          </div>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-12">
          <div className="p-6 bg-emerald-50 rounded-2xl border-2 border-emerald-100">
            <div className="text-emerald-600 text-4xl font-black mb-1">{correct}</div>
            <div className="text-[10px] text-emerald-700 uppercase font-black tracking-widest">Aciertos</div>
          </div>
          <div className="p-6 bg-red-50 rounded-2xl border-2 border-red-100">
            <div className="text-red-600 text-4xl font-black mb-1">{incorrect}</div>
            <div className="text-[10px] text-red-700 uppercase font-black tracking-widest">Errores</div>
          </div>
          <div className="p-6 bg-gray-50 rounded-2xl border-2 border-gray-200">
            <div className="text-gray-600 text-4xl font-black mb-1">{skipped}</div>
            <div className="text-[10px] text-gray-700 uppercase font-black tracking-widest">Blancos</div>
          </div>
        </div>

        <div className="text-left bg-indigo-900 text-white p-8 rounded-3xl mb-12 shadow-xl">
          <h4 className="font-black text-xs uppercase tracking-widest text-indigo-300 mb-4">Dictamen del Tribunal:</h4>
          <p className="text-xl leading-relaxed font-bold">
            {normalizedScore >= 50 
              ? "APTO. Resultados excelentes. Tu nivel de preparación es adecuado para la fase de oposición. Sigue repasando las guías CCN-STIC y el ENS 2022."
              : "NO APTO. Necesitas reforzar el temario. Recuerda que los errores descuentan 0,33. La estrategia de saltar preguntas dudosas es clave para el éxito."}
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={resetApp}
            className="flex-1 bg-white border-4 border-gray-900 text-gray-900 hover:bg-gray-50 font-black py-5 px-6 rounded-2xl transition-all uppercase tracking-widest text-sm"
          >
            Configurar Nuevo Test
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 bg-gray-900 hover:bg-black text-white font-black py-5 px-6 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-sm"
          >
            Exportar Resultados
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-24 pt-8 bg-[#f8fafc]">
      <main className="container mx-auto px-4">
        {step === 'setup' && renderSetup()}
        {step === 'loading' && renderLoading()}
        {step === 'testing' && renderTesting()}
        {step === 'results' && renderResults()}
      </main>

      <footer className="fixed bottom-0 w-full bg-white/80 backdrop-blur-md border-t border-gray-200 py-4 text-center">
        <p className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em]">
          Simulador de Examen GSI 2026 • Fuentes: CCN-CERT, AGE, CPS
        </p>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
