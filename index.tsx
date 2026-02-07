import React, { useState, useEffect, useMemo } from 'react';
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
  { id: 'BL1', name: 'Bloque I: Derecho Administrativo y Organización del Estado' },
  { id: 'BL2', name: 'Bloque II: Tecnología Básica' },
  { id: 'BL3', name: 'Bloque III: Desarrollo de Sistemas' },
  { id: 'BL4', name: 'Bloque IV: Sistemas y Comunicaciones' },
  { id: 'MOCK', name: 'Simulacro Completo (Proporción Oficial)' }
];

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

  const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY || '' }), []);

  const generateQuestions = async () => {
    setStep('loading');
    setIsGenerating(true);
    setLoadingMessage('Preparando el examen con el rigor de la CPS...');

    const systemInstruction = `
      Eres un experto preparador de la oposición de Gestión de Sistemas e Informática de la AGE (A2).
      Tu especialidad es diseñar cuestionarios con el mismo nivel de rigor y estilo que la Comisión Permanente de Selección (CPS).
      
      BLOQUES:
      - Bloque I: Derecho Administrativo y Organización del Estado (Leyes 39/2015, 40/2015, TREBEP, etc.)
      - Bloque II: Tecnología Básica (Hardware, SO, Virtualización, Cloud)
      - Bloque III: Desarrollo de Sistemas (Ciclo de vida, Metodologías, UML, Java, SQL)
      - Bloque IV: Sistemas y Comunicaciones (Redes, OSI, Seguridad, ENS, EHA)

      NORMAS:
      1. Fidelidad Documental: Basado estrictamente en normativa vigente (ENS 2022, EHA, Ley 39/2015).
      2. Nivel A2 - Gestión: Preguntas conceptuales y prácticas.
      3. Sin "Todas las anteriores" o "A y B son correctas" salvo que sea muy común en exámenes reales.
      4. Distractores plausibles.
      5. Formato JSON estricto.
    `;

    const count = selectedBlock === 'MOCK' ? Math.min(questionCount, 50) : questionCount; // Limit for prototype speed
    
    let prompt = `Genera ${count} preguntas de examen tipo test para el ${selectedBlock}.`;
    if (selectedBlock === 'MOCK') {
      prompt = `Genera un simulacro de ${count} preguntas respetando la proporcionalidad: 16% BL1, 26% BL2, 28% BL3, 29% BL4.`;
    }

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: prompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
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
    } catch (error) {
      console.error('Error generating questions:', error);
      alert('Hubo un error al generar las preguntas. Por favor, inténtalo de nuevo.');
      setStep('setup');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (option: string | null) => {
    setUserAnswers({ ...userAnswers, [currentIndex]: option });
    
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
      setCurrentIndex(currentIndex + 1);
    } else {
      setStep('results');
    }
  };

  const calculateScore = () => {
    let correct = 0;
    let incorrect = 0;
    let skipped = 0;

    questions.forEach((q, idx) => {
      const ans = userAnswers[idx];
      if (ans === null || ans === undefined) {
        skipped++;
      } else if (ans === q.respuesta_correcta) {
        correct++;
      } else {
        incorrect++;
      }
    });

    const finalScore = correct - (incorrect * (1/3));
    return { correct, incorrect, skipped, finalScore };
  };

  const renderSetup = () => (
    <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-xl material-card">
      <h1 className="text-3xl font-bold text-indigo-700 mb-6 flex items-center">
        <span className="mr-3">🏛️</span> AGE A2 - Preparador IT
      </h1>
      <p className="text-gray-600 mb-8">Configura tu sesión de estudio basada en el temario oficial de Gestión de Sistemas.</p>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Selecciona Bloque</label>
          <select 
            value={selectedBlock}
            onChange={(e) => setSelectedBlock(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
          >
            {BLOCKS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Número de Preguntas</label>
          <div className="flex gap-4">
            {[10, 20, 50, 100].map(n => (
              <button
                key={n}
                onClick={() => setQuestionCount(n)}
                className={`flex-1 py-2 px-4 rounded-lg border transition-all ${questionCount === n ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
              >
                {n}
              </button>
            ))}
          </div>
          {selectedBlock === 'MOCK' && questionCount < 100 && (
            <p className="text-xs text-amber-600 mt-2 italic">* Los simulacros oficiales suelen ser de 100 preguntas.</p>
          )}
        </div>

        <button
          onClick={generateQuestions}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg shadow-lg transform transition active:scale-95 mt-4"
        >
          EMPEZAR TEST
        </button>
      </div>
    </div>
  );

  const renderLoading = () => (
    <div className="max-w-2xl mx-auto mt-24 text-center">
      <div className="inline-block animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-indigo-600 mb-6"></div>
      <h2 className="text-xl font-medium text-gray-700">{loadingMessage}</h2>
      <p className="text-gray-500 mt-2">Estamos consultando la normativa más reciente...</p>
    </div>
  );

  const renderTesting = () => {
    const question = questions[currentIndex];
    if (!question) return null;

    return (
      <div className="max-w-3xl mx-auto mt-10 p-4">
        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Pregunta {currentIndex + 1} de {questions.length}</span>
            <span>{question.bloque}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-8 material-card relative overflow-hidden">
          {/* Difficulty badge */}
          <div className={`absolute top-0 right-0 px-4 py-1 text-xs font-bold uppercase rounded-bl-lg ${
            question.dificultad === 'alta' ? 'bg-red-100 text-red-700' : 
            question.dificultad === 'media' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
          }`}>
            Dificultad {question.dificultad}
          </div>

          <h3 className="text-xl font-medium text-gray-800 mb-8 leading-relaxed">
            {question.enunciado}
          </h3>

          <div className="space-y-4">
            {Object.entries(question.opciones).map(([key, text]) => (
              <button
                key={key}
                disabled={showFeedback}
                onClick={() => handleAnswer(key)}
                className={`w-full text-left p-4 rounded-lg border-2 transition-all flex items-start ${
                  showFeedback && key === question.respuesta_correcta 
                    ? 'bg-green-50 border-green-500 ring-2 ring-green-200' 
                    : showFeedback && userAnswers[currentIndex] === key && key !== question.respuesta_correcta
                    ? 'bg-red-50 border-red-500'
                    : 'bg-white border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 active:bg-indigo-100'
                } ${showFeedback ? 'cursor-default' : 'cursor-pointer'}`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center mr-3 text-sm font-bold flex-shrink-0 ${
                   showFeedback && key === question.respuesta_correcta ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {key.toUpperCase()}
                </span>
                <span className="text-gray-700">{text}</span>
              </button>
            ))}
          </div>

          {!showFeedback && (
            <div className="mt-8 pt-6 border-t flex justify-between">
              <button 
                onClick={() => handleAnswer(null)}
                className="text-gray-500 hover:text-gray-700 font-medium transition"
              >
                Dejar en blanco (No contesta)
              </button>
            </div>
          )}

          {showFeedback && (
            <div className="mt-8 animate-fadeIn">
              <div className={`p-4 rounded-lg mb-6 ${userAnswers[currentIndex] === null ? 'bg-blue-50 text-blue-800' : 'bg-red-50 text-red-800'}`}>
                <h4 className="font-bold mb-1">
                  {userAnswers[currentIndex] === null ? 'Pregunta saltada' : 'Respuesta incorrecta'}
                </h4>
                <p className="text-sm leading-relaxed">{question.justificacion}</p>
              </div>
              <button
                onClick={handleNext}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow transition"
              >
                {currentIndex < questions.length - 1 ? 'Siguiente Pregunta' : 'Ver Resultados Finales'}
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
    const percentage = ((finalScore / maxScore) * 100).toFixed(1);

    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-xl material-card text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Examen Finalizado</h2>
        <div className="text-6xl font-bold text-indigo-600 my-8">
          {finalScore.toFixed(2)}
          <span className="text-2xl text-gray-400 font-normal ml-2">/ {maxScore}</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="p-4 bg-green-50 rounded-lg">
            <div className="text-green-600 text-2xl font-bold">{correct}</div>
            <div className="text-xs text-green-700 uppercase font-bold">Correctas</div>
          </div>
          <div className="p-4 bg-red-50 rounded-lg">
            <div className="text-red-600 text-2xl font-bold">{incorrect}</div>
            <div className="text-xs text-red-700 uppercase font-bold">Incorrectas</div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-gray-600 text-2xl font-bold">{skipped}</div>
            <div className="text-xs text-gray-700 uppercase font-bold">Saltadas</div>
          </div>
        </div>

        <div className="text-left bg-gray-50 p-6 rounded-lg mb-8 border border-gray-100">
          <h4 className="font-bold text-gray-700 mb-3">Valoración del tribunal:</h4>
          <p className="text-gray-600 leading-relaxed">
            {Number(percentage) >= 50 
              ? "Excelente rendimiento. Sigues una buena trayectoria para el subgrupo A2. Mantén este ritmo de estudio especialmente en los bloques técnicos."
              : "Necesitas reforzar los conceptos base. Recuerda que los errores restan 1/3, sé más selectivo al responder si no estás seguro de la normativa."}
          </p>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => {
              setStep('setup');
              setCurrentIndex(0);
              setUserAnswers({});
              setShowFeedback(false);
            }}
            className="flex-1 bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-bold py-3 px-6 rounded-lg transition"
          >
            NUEVO TEST
          </button>
          <button
            onClick={() => window.print()}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg shadow transition"
          >
            IMPRIMIR RESULTADOS
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen pb-20">
      <nav className="bg-indigo-800 text-white py-4 px-6 shadow-md mb-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <span className="font-bold text-lg tracking-tight">AGE A2 | Gestión IT Prep</span>
          {step === 'testing' && (
            <span className="bg-indigo-700 px-3 py-1 rounded-full text-sm">
              Sesión Activa
            </span>
          )}
        </div>
      </nav>

      <main className="container mx-auto px-4">
        {step === 'setup' && renderSetup()}
        {step === 'loading' && renderLoading()}
        {step === 'testing' && renderTesting()}
        {step === 'results' && renderResults()}
      </main>

      <footer className="fixed bottom-0 w-full bg-white border-t border-gray-200 py-3 text-center text-xs text-gray-400">
        Basado en el temario actualizado de Gestión de Sistemas e Informática del Estado.
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);