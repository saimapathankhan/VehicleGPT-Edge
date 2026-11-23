
"use client";

import { useCallback, useEffect, useState } from "react";

const API = "http://127.0.0.1:8000";

type Vehicle = {
  id: number;
  name: string;
  registration_number: string;
  model: string;
  status: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionInstance;
  webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
};

export default function Home() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selected, setSelected] = useState("");
  const [apiStatus, setApiStatus] = useState("Connecting");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");

  const loadVehicles = useCallback(async () => {
    try {
      setApiStatus("Connecting");
      const response = await fetch(`${API}/vehicles`);

      if (!response.ok) throw new Error("Vehicle API unavailable");

      const data: Vehicle[] = await response.json();
      setVehicles(data);

      setSelected((previous) =>
        data.some((v) => String(v.id) === previous)
          ? previous
          : data.length ? String(data[0].id) : ""
      );

      setApiStatus("Connected");
      setError("");
    } catch {
      setApiStatus("Offline");
      setError("Backend unavailable. Start FastAPI on port 8000.");
    }
  }, []);

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

  const currentVehicle = vehicles.find(
    (v) => String(v.id) === selected
  );

  async function askAI(promptOverride?: string, speakResponse = false) {
    const prompt = (promptOverride ?? question).trim();
    if (!prompt || loading) return;

    setQuestion(prompt);
    setAnswer("");
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API}/ai/diagnostics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicle_id: selected ? Number(selected) : null,
          question: prompt,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.detail ?? "AI diagnostics failed");
      }

      const result = data.answer ?? data.response ?? data.message;
      const text =
        typeof result === "string"
          ? result
          : JSON.stringify(result ?? "No response received", null, 2);

      setAnswer(text);

      if (speakResponse) speakText(text);
    } catch (err) {
      setAnswer(
        err instanceof Error ? err.message : "Unable to get AI response"
      );
    } finally {
      setLoading(false);
    }
  }

  function speakText(text: string) {
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(text);
    speech.lang = "en-IN";
    speech.rate = 0.95;
    window.speechSynthesis.speak(speech);
  }

  function startVoice() {
    const speechWindow = window as SpeechWindow;
    const Recognition =
      speechWindow.SpeechRecognition ??
      speechWindow.webkitSpeechRecognition;

    if (!Recognition) {
      setError("Voice recognition is not supported in this browser.");
      return;
    }

    setError("");
    setListening(true);

    const recognition = new Recognition();
    recognition.lang = "en-IN";

    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript.trim()) {
        setQuestion(transcript);
        void askAI(transcript, true);
      }
    };

    recognition.onerror = () => {
      setError("Microphone permission or voice recognition failed.");
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    try {
      recognition.start();
    } catch {
      setListening(false);
      setError("Could not start microphone.");
    }
  }

  const healthyCount = vehicles.filter(
    (v) => v.status?.toLowerCase() === "healthy"
  ).length;

  const panel =
    "cockpit-panel rounded-2xl p-5 sm:p-6";

  return (
    <main className="min-h-screen px-3 py-4 text-slate-100 sm:px-6 lg:px-9">

      {/* Top navigation */}
      <header className="mx-auto mb-7 flex max-w-[1600px] flex-wrap items-center justify-between gap-4 border-b border-sky-300/10 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-300/30 bg-sky-400/10 text-2xl text-sky-300">
            ⚡
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-widest">
              VEHICLE<span className="text-sky-400">GPT</span>
            </h1>
            <p className="text-[9px] tracking-[.3em] text-slate-500">
              EDGE INTELLIGENCE SYSTEM
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className={`h-2 w-2 rounded-full ${
            apiStatus === "Connected" ? "bg-emerald-400" : "bg-amber-400"
          }`} />
          <span className="text-slate-300">API {apiStatus}</span>
          <button
            onClick={() => void loadVehicles()}
            className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/10"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px]">

        {/* Cockpit heading */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-[10px] font-bold tracking-[.3em] text-sky-400">
              DIGITAL ELECTRIC VEHICLE COCKPIT
            </p>
            <h2 className="text-3xl font-light tracking-tight sm:text-4xl">
              Your vehicle. <span className="text-sky-400">Your intelligence.</span>
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Smart mobility and AI-powered vehicle monitoring.
            </p>
          </div>

          <div className="rounded-xl border border-sky-300/20 bg-sky-400/5 px-4 py-3">
            <p className="text-[9px] tracking-widest text-slate-500">DRIVING MODE</p>
            <p className="mt-1 text-sm font-semibold text-sky-300">
              EV COCKPIT
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
            {error}
          </div>
        )}

        {/* Main dashboard */}
        <section className="grid gap-5 xl:grid-cols-[1fr_1.65fr_1fr]">

          {/* Driver instrument cluster */}
          <div className={`${panel} cockpit-glow`}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[.2em] text-slate-500">
                  DRIVER DISPLAY
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  Instrument cluster
                </h3>
              </div>
              <span className="text-xl text-sky-400">◉</span>
            </div>

            <div className="flex flex-col items-center justify-center rounded-2xl border border-sky-300/10 bg-[#080f19] py-8">
              <div className="relative flex h-44 w-44 items-center justify-center rounded-full border-[8px] border-sky-400/20">
                <div className="absolute inset-2 rounded-full border border-sky-300/10" />
                <div className="text-center">
                  <p className="text-5xl font-light text-white">—</p>
                  <p className="mt-2 text-xs tracking-widest text-slate-500">
                    KM/H
                  </p>
                </div>
              </div>
              <p className="mt-5 text-[10px] tracking-[.25em] text-slate-500">
                SPEED DATA NOT CONNECTED
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[.035] p-4">
                <span className="text-xl text-emerald-400">ϟ</span>
                <p className="mt-2 text-xl font-semibold">—</p>
                <p className="text-[10px] text-slate-500">BATTERY SOC</p>
              </div>
              <div className="rounded-xl bg-white/[.035] p-4">
                <span className="text-xl text-sky-400">⌁</span>
                <p className="mt-2 text-xl font-semibold">—</p>
                <p className="text-[10px] text-slate-500">RANGE (KM)</p>
              </div>
            </div>

            <p className="mt-4 text-[10px] leading-5 text-slate-500">
              Live speed, battery and range require compatible vehicle telemetry.
            </p>
          </div>

          {/* Central infotainment display */}
          <div className={`${panel} cockpit-glow`}>
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[10px] tracking-[.2em] text-slate-500">
                  CENTRAL INFOTAINMENT
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  Vehicle command center
                </h3>
              </div>
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] text-emerald-300">
                {apiStatus.toUpperCase()}
              </span>
            </div>

            <div className="relative flex min-h-[210px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-sky-300/10 bg-gradient-to-br from-[#102b43] via-[#0b1727] to-[#090f19] p-5 text-center">
              <div className="absolute h-48 w-48 rounded-full border border-sky-400/10" />
              <div className="absolute h-36 w-36 rounded-full border border-sky-400/15" />
              <div className="relative text-5xl text-sky-300">✧</div>
              <p className="relative mt-4 text-lg font-semibold">
                Hello, Driver.
              </p>
              <p className="relative mt-2 text-xs text-slate-400">
                Your AI vehicle companion is ready.
              </p>
              <button
                onClick={startVoice}
                disabled={listening || loading}
                className="relative mt-5 rounded-full border border-sky-300/40 bg-sky-400/10 px-6 py-3 text-xs font-semibold text-sky-200 hover:bg-sky-400/20 disabled:opacity-50"
              >
                {listening ? "🎙 Listening..." : "🎙 Talk to VehicleGPT"}
              </button>
            </div>

            <div className="mt-5">
              <label className="text-[10px] tracking-widest text-slate-500">
                SELECT YOUR VEHICLE
              </label>
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="mt-2 w-full rounded-xl border border-sky-300/20 bg-[#0a1421] p-3 text-sm outline-none focus:border-sky-400"
              >
                {vehicles.length === 0 && (
                  <option value="">No vehicles available</option>
                )}
                {vehicles.map((v) => (
                  <option key={v.id} value={String(v.id)}>
                    {v.name} · {v.registration_number}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                ["⌖", "Navigation"],
                ["ϟ", "Charging"],
                ["◈", "Diagnostics"],
              ].map(([icon, label]) => (
                <div key={label} className="rounded-xl border border-white/5 bg-white/[.035] p-3 text-center">
                  <p className="text-xl text-sky-300">{icon}</p>
                  <p className="mt-2 text-[10px] text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Vehicle health */}
          <div className={`${panel} cockpit-glow`}>
            <div className="mb-6">
              <p className="text-[10px] tracking-[.2em] text-slate-500">
                VEHICLE INTELLIGENCE
              </p>
              <h3 className="mt-1 text-lg font-semibold">Vehicle health</h3>
            </div>

            <div className="rounded-xl border border-white/5 bg-white/[.035] p-4">
              <p className="text-[10px] text-slate-500">SELECTED VEHICLE</p>
              <p className="mt-2 text-lg font-semibold">
                {currentVehicle?.name ?? "No vehicle selected"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {currentVehicle?.registration_number ?? "Awaiting vehicle"}
              </p>
            </div>

            <div className="mt-3 space-y-3">
              {[
                ["Vehicle status", currentVehicle?.status ?? "Unavailable"],
                ["Vehicle model", currentVehicle?.model ?? "Unavailable"],
                ["Fleet vehicles", String(vehicles.length)],
                ["Healthy vehicles", String(healthyCount)],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-white/5 py-3">
                  <span className="text-xs text-slate-400">{label}</span>
                  <span className="max-w-[55%] truncate text-xs font-semibold text-sky-200">
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-sky-300/10 bg-sky-400/5 p-4">
              <p className="text-xs font-semibold text-sky-300">
                SENSOR TELEMETRY
              </p>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Live battery, motor and temperature diagnostics will appear
                here after sensor integration.
              </p>
              <span className="mt-3 inline-block rounded-full bg-amber-400/10 px-3 py-1 text-[9px] text-amber-300">
                DATA CONNECTION PENDING
              </span>
            </div>
          </div>
        </section>

        {/* AI assistant */}
        <section className={`${panel} mt-5`}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] tracking-[.25em] text-sky-400">
                VOICE & INTELLIGENCE
              </p>
              <h3 className="mt-1 text-xl font-semibold">
                VehicleGPT AI Assistant
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Ask about your vehicle, health and maintenance.
              </p>
            </div>
            <span className="rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-xs text-violet-300">
              ✧ AI ACTIVE
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              "Explain vehicle health",
              "Which vehicle needs attention?",
              "Check battery condition",
              "What maintenance is required?",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => void askAI(suggestion)}
                disabled={loading}
                className="rounded-full border border-white/10 px-3 py-2 text-[11px] text-slate-300 hover:border-sky-400/40 hover:bg-sky-400/10 disabled:opacity-50"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void askAI();
              }}
              placeholder="Hey VehicleGPT, how is my vehicle performing?"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#080f19] px-4 py-4 text-sm outline-none placeholder:text-slate-600 focus:border-sky-400/50"
            />
            <button
              onClick={() => void askAI()}
              disabled={loading}
              className="rounded-xl bg-sky-500 px-7 py-3 text-sm font-bold text-[#04111c] hover:bg-sky-300 disabled:opacity-50"
            >
              {loading ? "Analysing..." : "Send ↗"}
            </button>
            <button
              onClick={startVoice}
              disabled={listening || loading}
              className="rounded-xl border border-sky-300/30 px-5 py-3 text-sm text-sky-200 hover:bg-sky-400/10 disabled:opacity-50"
            >
              🎙 Voice
            </button>
          </div>

          {loading && (
            <div className="mt-5 animate-pulse rounded-xl bg-sky-400/5 p-4 text-sm text-sky-300">
              Analysing vehicle information...
            </div>
          )}

          {answer && (
            <div className="mt-5 rounded-xl border border-sky-300/20 bg-sky-400/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-bold tracking-widest text-sky-300">
                  AI DIAGNOSTICS RESPONSE
                </p>
                <button
                  onClick={() => speakText(answer)}
                  className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
                >
                  🔊 Speak answer
                </button>
              </div>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                {answer}
              </p>
            </div>
          )}
        </section>

        {/* Fleet section */}
        <section className={`${panel} mt-5`}>
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-[10px] tracking-[.2em] text-slate-500">
                MOBILITY MANAGEMENT
              </p>
              <h3 className="mt-1 text-lg font-semibold">My vehicles</h3>
            </div>
            <span className="text-xs text-slate-400">
              {vehicles.length} registered
            </span>
          </div>

          {vehicles.length === 0 ? (
            <p className="text-sm text-slate-500">
              No vehicle records available. Check your backend connection.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {vehicles.map((vehicle) => (
                <button
                  key={vehicle.id}
                  onClick={() => setSelected(String(vehicle.id))}
                  className={`rounded-xl border p-4 text-left transition ${
                    selected === String(vehicle.id)
                      ? "border-sky-400/50 bg-sky-400/10"
                      : "border-white/10 bg-white/[.025] hover:border-sky-400/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-2xl text-sky-300">▰</span>
                    <span className="text-[10px] text-emerald-300">
                      ● {vehicle.status}
                    </span>
                  </div>
                  <p className="mt-4 font-semibold">{vehicle.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {vehicle.registration_number}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {vehicle.model}
                  </p>
                </button>
              ))}
            </div>
          )}
        </section>

        <footer className="py-8 text-center text-[10px] tracking-widest text-slate-600">
          VEHICLEGPT EDGE · ELECTRIC MOBILITY INTELLIGENCE · PROTOTYPE
        </footer>
      </div>
    </main>
  );
}
