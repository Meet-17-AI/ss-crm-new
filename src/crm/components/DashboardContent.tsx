import { useState, useEffect } from 'react'
import MonthFilter from './MonthFilter'
import { Loader } from '../../../components/Loader'
import ToDoModal from './ToDoModal'

interface DashboardContentProps {
  currentUser?: any
  setCurrentPage?: (page: string) => void
}

const DashboardContent = ({ currentUser, setCurrentPage }: DashboardContentProps) => {
  const [loading, setLoading] = useState(true)
  const getCurrentMonth = () => {
    const now = new Date()
    return `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()}`
  }
  const [sourceMonth, setSourceMonth] = useState(getCurrentMonth)
  const [funnelMonth, setFunnelMonth] = useState(getCurrentMonth)
  const [statsMonth, setStatsMonth] = useState('All Time')
  const [totalLeads, setTotalLeads] = useState(0)
  const [dropouts, setDropouts] = useState(0)
  const [closed, setClosed] = useState(0)
  const [conversionCount, setConversionCount] = useState(0)
  const [leadSources, setLeadSources] = useState([
    { name: 'Chatbot', value: 0 },
    { name: 'Website', value: 0 },
    { name: 'Admin - Call', value: 0 },
    { name: 'Admin - WhatsApp', value: 0 },
    { name: 'Intake Form', value: 0 },
    { name: 'Instagram', value: 0 },
    { name: 'Google Search', value: 0 },
    { name: 'Linkedin', value: 0 },
    { name: 'Pooja Reference', value: 0 },
    { name: 'Other', value: 0 },
  ])
  const [funnelStages, setFunnelStages] = useState([
    { label: 'Inquiry/Lead', value: 0, percentage: 100 },
    { label: 'Pre-Therapy Call', value: 0, percentage: 0 },
    { label: 'Booked First Session', value: 0, percentage: 0 },
    { label: 'Continued Session Beyond 3', value: 0, percentage: 0 }
  ])

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (sourceMonth) queryParams.append('sourceMonth', sourceMonth);
        if (funnelMonth) queryParams.append('funnelMonth', funnelMonth);
        if (statsMonth && statsMonth !== 'All Time') queryParams.append('statsMonth', statsMonth);
        const response = await fetch(`/api/analytics?${queryParams.toString()}`)
        if (response.ok) {
          const data = await response.json()
          setTotalLeads(data.totalLeads)
          if (data.dropouts !== undefined) setDropouts(data.dropouts)
          if (data.closed !== undefined) setClosed(data.closed)
          if (data.allTimeBookedCount !== undefined) setConversionCount(data.allTimeBookedCount)
          if (data.sources) {
            const standardSources = [
              'Chatbot', 'Website', 'Admin - Call', 'Admin - WhatsApp',
              'Intake Form', 'Instagram', 'Google Search', 'Linkedin',
              'Pooja Reference', 'Other'
            ];
            
            const sourceMap: Record<string, number> = {};
            standardSources.forEach(s => sourceMap[s] = 0);
            
            data.sources.forEach((s: any) => {
              const name = s.name || 'Other';
              const standardMatch = standardSources.find(ss => ss.toLowerCase() === name.toLowerCase());
              if (standardMatch) {
                sourceMap[standardMatch] = s.value;
              } else {
                sourceMap[name] = s.value;
              }
            });
            
            setLeadSources(Object.entries(sourceMap).map(([name, value]) => ({ name, value })));
          }

          if (data.funnel) {
            const getStageValue = (dbStage: string) => {
              return data.funnel.find((f: any) => f.label === dbStage)?.value || 0;
            };

            const STAGES = [
              { id: 'lead-inquire', label: 'Lead / Inquire' },
              { id: 'pretherapy-call', label: 'Pre-therapy Call' },
              { id: 'followup-1', label: 'Follow Ups' },
              { id: 'booked-first-session', label: 'Booked First Session' },
              { id: 'referred', label: 'Referred' },
              { id: 'closed', label: 'Closed' },
              { id: 'dropouts', label: 'Unresponsive' },
              { id: 'leaks', label: 'Leaks' },
            ];

            const totalMonthlyLeads = STAGES.reduce((acc, stage) => acc + getStageValue(stage.id), 0);
            const topOfFunnel = Math.max(totalMonthlyLeads, 1);

            const calcPercentage = (val: number, total: number) => total > 0 ? Math.round((val / total) * 100) : 0;

            const newFunnelStages = STAGES.map(stage => {
              const val = getStageValue(stage.id);
              return {
                label: stage.label,
                value: val,
                percentage: calcPercentage(val, topOfFunnel)
              };
            });

            setFunnelStages(newFunnelStages);
          }
        }
      } catch (error) {
        console.error('Failed to fetch analytics', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalytics()
  }, [sourceMonth, funnelMonth, statsMonth])

  const modules = [
    { id: 1, title: 'Total Leads', value: totalLeads.toString() },
    { id: 2, title: 'Lead to first session conversion', value: conversionCount.toString() },
    { id: 3, title: 'Unresponsive', value: dropouts.toString() },
    { id: 4, title: 'Closed', value: closed.toString() },
  ]

  const leadSourcesData = leadSources;
  const maxValue = Math.max(...leadSourcesData.map(s => s.value), 4)

  if (loading) {
    return (
      <div className="w-full h-full bg-gray-50 relative flex items-center justify-center min-h-[400px]">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex-1 h-screen overflow-auto bg-gray-50">
      <div className="w-full relative min-h-full">
      <header className="mb-8 pt-8 pl-8 pr-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold mb-1">Analytics</h1>
            <p className="text-gray-600 text-sm">Welcome {currentUser?.full_name || currentUser?.name || 'User'}, to SafeStories CRM Analytics!</p>
          </div>
          <MonthFilter selectedMonth={statsMonth} onChange={setStatsMonth} />
        </div>
      </header>

      <div className="pl-8 pr-8 pb-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {modules.map((module) => (
            <div key={module.id} className="bg-white rounded-xl shadow-sm border border-gray-100 transition-shadow hover:shadow-md p-6">
              <div className="text-sm text-gray-600 mb-2">{module.title}</div>
              <div className="text-3xl font-bold text-gray-900">{module.value}</div>
            </div>
          ))}
        </div>

        <ToDoModal 
          setCurrentPage={setCurrentPage}
          onViewLead={(leadId) => {
            if (setCurrentPage) {
              setCurrentPage(`lead-profile:${leadId}:analytics`);
            }
          }}
        />

        {/* Lead Source Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 transition-shadow hover:shadow-md mb-8">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-bold">Lead Source</h2>
            <MonthFilter selectedMonth={sourceMonth} onChange={setSourceMonth} />
          </div>
          <div className="p-6">
            <div className="flex gap-4">
              <div className="flex flex-col justify-between text-xs text-gray-500 w-12 pb-10">
                {[maxValue, Math.floor(maxValue * 0.75), Math.floor(maxValue * 0.5), Math.floor(maxValue * 0.25), 0].map((tick, i) => (
                  <div key={i} className="text-right">{tick}</div>
                ))}
              </div>
              <div className="flex-1 overflow-x-auto custom-scrollbar">
                <div className="flex items-end justify-start gap-3 border-l border-b border-gray-200 pl-4 pb-4 min-w-max h-[250px]">
                  {leadSourcesData.map((source, i) => (
                    <div key={i} className="flex flex-col items-center justify-end gap-2 w-20 flex-shrink-0 h-full">
                      <div className="w-full flex justify-center items-end h-full">
                        <div
                          className="w-10 rounded-t flex items-start justify-center pt-2 transition-all duration-300 hover:opacity-80"
                          style={{ 
                            height: `${Math.max((source.value / maxValue) * 200, leadSourcesData.length > 5 ? 10 : 24)}px`, 
                            backgroundColor: '#21615D',
                            minHeight: source.value > 0 ? '10px' : '2px'
                          }}
                        >
                          {source.value > 0 && <span className="text-white text-[10px] font-bold">{source.value}</span>}
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-600 text-center whitespace-nowrap overflow-hidden text-ellipsis w-full" title={source.name}>
                        {source.name}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>


      </div>
      </div>
    </div>
  )
}

export default DashboardContent
