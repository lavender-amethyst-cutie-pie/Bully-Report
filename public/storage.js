(function () {
  const STORAGE_KEY = 'bully-report-v1';
  const sampleReports = [
    {
      id: 'sample-1',
      sample: true,
      firstName: 'Jordan',
      grade: '7',
      teacherName: '',
      description: 'A student keeps making jokes about my nationality every day in class.',
      createdAt: 'Example',
    },
    {
      id: 'sample-2',
      sample: true,
      firstName: 'Sam',
      grade: '8',
      teacherName: '',
      description: 'Someone pushed me near the lockers and said they will do it again tomorrow.',
      createdAt: 'Example',
    },
    {
      id: 'sample-3',
      sample: true,
      firstName: 'Taylor',
      grade: '',
      teacherName: 'Ms. Lee',
      description: 'A group sent a rude message that may have been a joke, but I feel unsafe.',
      createdAt: 'Example',
    },
  ];

  function readReports() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      return Array.isArray(saved) && saved.length ? saved : sampleReports;
    } catch {
      return sampleReports;
    }
  }

  function saveReport(report) {
    const reports = readReports().filter((item) => !item.sample);
    const next = [{ ...report, id: `report-${Date.now()}`, sample: false }, ...reports].slice(0, 20);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  function clearSavedReports() {
    localStorage.removeItem(STORAGE_KEY);
  }

  window.BullyStorage = { readReports, saveReport, clearSavedReports };
})();
