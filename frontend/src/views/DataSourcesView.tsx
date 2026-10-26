import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  HardDrive,
  Cpu,
  Clock,
  Layers,
  Info
} from 'lucide-react';
import type { DataSourceMeta } from '../types';
import { api } from '../services/api';

export const DataSourcesView: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSourceMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDataSources();
  }, []);

  async function loadDataSources() {
    setLoading(true);
    try {
      const list = await api.getDataSources();
      setDataSources(list);
    } catch (err) {
      console.error('Failed to load data sources:', err);
    } finally {
      setLoading(false);
    }
  }

  const certDataSources = [
    {
      name: 'logon.csv (CERT r4.2)',
      events: '850,000+ records',
      size: '55.8 MB',
      types: 'Logon, Logoff, Working-Hours Derivation',
      status: 'Active / Ingested',
      isSupported: true
    },
    {
      name: 'device.csv (CERT r4.2)',
      events: '400,000+ records',
      size: '27.6 MB',
      types: 'Removable USB Connect & Disconnect',
      status: 'Active / Ingested',
      isSupported: true
    },
    {
      name: 'file.csv (CERT r4.2)',
      events: '800,000+ records',
      size: '184.1 MB',
      types: 'Removable File Copies & Reads',
      status: 'Active / Ingested',
      isSupported: true
    },
    {
      name: 'http.csv & email.csv',
      events: '4,330 Observables',
      size: '~2.2 GB',
      types: 'Web Browsing & Corporate Email',
      status: 'Not Ingested (Out of Scope)',
      isSupported: false
    },
    {
      name: 'sample_security_events.csv',
      events: '2,173 records',
      size: '420 KB',
      types: 'Logon, File, USB, Cloud, Email',
      status: 'Active / Demo Isolated',
      isSupported: true
    }
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 bg-[#0A0A0A] text-[#D8D8D8] animate-fade-in font-sans">
      {/* Editorial Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-[#292929] pb-5 gap-4">
        <div>
          <div className="text-[11px] font-mono tracking-widest text-[#F2D35E] uppercase">
            Data Provenance & Telemetry Ingestion
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-normal tracking-tight text-white mt-1">
            Data <span className="italic text-[#F2D35E]">Sources</span>
          </h1>
          <p className="text-xs text-[#A0A0A0] mt-1 font-light max-w-2xl">
            Ingestion status, record volumes, and supported event types across research and demo datasets.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-[#10B981]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Apache Parquet Active</span>
        </div>
      </div>

      {/* Scope Limitation Notice */}
      <div className="p-3.5 bg-[#141414] border border-[#222222] text-xs font-mono text-[#A0A0A0] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-[#F2D35E] shrink-0" />
          <span>
            <strong className="text-white">Telemetry Scope:</strong> CyberDNA currently ingests and analyzes logon, device, and file telemetry. HTTP and email streams are not processed by the existing pipeline.
          </span>
        </div>
      </div>

      {/* Compact Data Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {certDataSources.map((source, idx) => (
          <div
            key={idx}
            className={`p-4 bg-[#111111] border space-y-3 ${
              source.isSupported ? 'border-[#222222]' : 'border-[#332222] bg-[#141010]'
            }`}
          >
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-white truncate">{source.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 border ${
                source.isSupported
                  ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30'
                  : 'bg-[#EF4444]/10 text-[#EF4444] border-[#EF4444]/30'
              }`}>
                {source.status}
              </span>
            </div>

            <div className="space-y-1.5 text-[11px] font-mono text-[#A0A0A0]">
              <div className="flex justify-between">
                <span>Record Count:</span>
                <span className="text-white">{source.events}</span>
              </div>
              <div className="flex justify-between">
                <span>File Size:</span>
                <span className="text-white">{source.size}</span>
              </div>
              <div className="flex justify-between">
                <span>Event Types:</span>
                <span className="text-[#CCCCCC] truncate max-w-[170px]">{source.types}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* PySpark Pipeline Architecture (Moved Here from AnalyticsView) */}
      <div className="bg-[#111111] border border-[#292929] p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-[#222222] pb-3">
          <div>
            <h2 className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#F2D35E]" />
              PySpark Analytics Pipeline Architecture
            </h2>
            <p className="text-[11px] text-[#777777] font-light">
              Distributed batch processing flow from raw CSV to Snappy-compressed Apache Parquet.
            </p>
          </div>
          <span className="text-[10px] font-mono text-[#F2D35E] border border-[#52441A] px-2 py-0.5 bg-[#1A180D]">
            PySpark 3.5.0
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
          <div className="p-3 bg-[#141414] border border-[#222222] space-y-1">
            <div className="text-[10px] text-[#F2D35E] font-bold">Step 1: Ingestion</div>
            <p className="text-[11px] text-[#A0A0A0]">Read raw CSVs with schema enforcement</p>
          </div>
          <div className="p-3 bg-[#141414] border border-[#222222] space-y-1">
            <div className="text-[10px] text-[#F2D35E] font-bold">Step 2: Cleaning</div>
            <p className="text-[11px] text-[#A0A0A0]">Drop nulls and deduplicate event IDs</p>
          </div>
          <div className="p-3 bg-[#141414] border border-[#222222] space-y-1">
            <div className="text-[10px] text-[#F2D35E] font-bold">Step 3: Temporal Slicing</div>
            <p className="text-[11px] text-[#A0A0A0]">Flag off-hours (outside 07:00–19:00)</p>
          </div>
          <div className="p-3 bg-[#141414] border border-[#222222] space-y-1">
            <div className="text-[10px] text-[#F2D35E] font-bold">Step 4: Aggregation</div>
            <p className="text-[11px] text-[#A0A0A0]">Rollup logons, USB, and file counts</p>
          </div>
          <div className="p-3 bg-[#141414] border border-[#222222] space-y-1">
            <div className="text-[10px] text-[#F2D35E] font-bold">Step 5: Alert Rules</div>
            <p className="text-[11px] text-[#A0A0A0]">Apply explainable heuristic rules</p>
          </div>
          <div className="p-3 bg-[#141414] border border-[#222222] space-y-1">
            <div className="text-[10px] text-[#F2D35E] font-bold">Step 6: Parquet</div>
            <p className="text-[11px] text-[#A0A0A0]">Write Snappy-compressed Parquet</p>
          </div>
        </div>
      </div>
    </div>
  );
};
