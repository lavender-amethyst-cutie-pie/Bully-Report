(function () {
  const form = document.querySelector('#report-form');
  const grade = document.querySelector('#grade');
  const teacherField = document.querySelector('#teacher-field');
  const analyzeButton = document.querySelector('#analyze-button');
  const thinking = document.querySelector('#thinking');
  const resultPanel = document.querySelector('#result-panel');
  const resultTitle = document.querySelector('#result-title');
  const resultText = document.querySelector('#result-text');
  const resultMeta = document.querySelector('#result-meta');
  const followUpSection = document.querySelector('#follow-up-section');
  const followUp = document.querySelector('#follow-up');
  const guidanceButton = document.querySelector('#guidance-button');
  const saveButton = document.querySelector('#save-button');
  const savedList = document.querySelector('#saved-list');
  const statusMessage = document.querySelector('#status-message');
  let latestReport = null;
  let latestQuestions = '';

  function showMessage(message, kind) {
    statusMessage.textContent = message;
    statusMessage.className = `message ${kind || ''}`;
  }

  function updateTeacherField() {
    const needsTeacher = grade.value === 'unknown';
    teacherField.hidden = !needsTeacher;
    document.querySelector('#teacher-name').required = needsTeacher;
  }

  function setBusy(isBusy, button) {
    analyzeButton.disabled = isBusy;
    guidanceButton.disabled = isBusy;
    if (button) button.disabled = isBusy;
    thinking.hidden = !isBusy;
  }

  function getFormData() {
    return {
      firstName: document.querySelector('#first-name').value.trim(),
      grade: grade.value,
      teacherName: document.querySelector('#teacher-name').value.trim(),
      report: document.querySelector('#description').value.trim(),
    };
  }

  async function askAI(stage, button) {
    const data = getFormData();
    if (data.report.length < 5) {
      showMessage('Please describe what happened in a few words first.', 'error');
      document.querySelector('#description').focus();
      return;
    }

    setBusy(true, button);
    showMessage('', '');
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, stage, followUp: followUp.value.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The AI could not answer right now.');

      latestReport = data;
      if (stage === 'questions') {
        latestQuestions = result.text;
        resultTitle.textContent = result.offline ? 'Questions to help you decide' : 'Questions from the AI';
        resultMeta.textContent = result.offline
          ? 'Local safety guide is active while the AI connection is unavailable.'
          : 'Answer these if you can. You can also tell a trusted adult now.';
        followUpSection.hidden = false;
        guidanceButton.hidden = false;
      } else {
        resultTitle.textContent = 'Safe next step';
        resultMeta.textContent = result.offline
          ? 'Local safety guide · An adult should double-check this next step.'
          : `AI helper: ${result.model || 'Luna'} · Double-check with a trusted adult.`;
        followUpSection.hidden = true;
        guidanceButton.hidden = true;
      }
      resultText.textContent = result.text;
      resultPanel.hidden = false;
      resultPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showMessage(
        result.offline
          ? 'Your report was understood. A trusted adult should make the final safety decision.'
          : 'The AI answered. Remember: a trusted adult makes the final safety decision.',
        'success',
      );
    } catch (error) {
      showMessage(error.message || 'The AI could not answer right now. Please check the key and your internet connection.', 'error');
    } finally {
      setBusy(false, button);
    }
  }

  function renderSavedReports() {
    const reports = window.BullyStorage.readReports();
    savedList.replaceChildren();
    reports.forEach((report) => {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = report.sample ? 'Made-up example' : `Saved report · ${report.createdAt || 'This computer'}`;
      const detail = document.createElement('span');
      detail.textContent = `${report.firstName || 'No first name'} · ${report.grade || 'Grade not listed'} · ${report.description}`;
      item.append(title, detail);
      savedList.appendChild(item);
    });
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    askAI('questions', analyzeButton);
  });

  grade.addEventListener('change', updateTeacherField);
  guidanceButton.addEventListener('click', () => askAI('guidance', guidanceButton));
  saveButton.addEventListener('click', () => {
    if (!latestReport) return;
    window.BullyStorage.saveReport({
      ...latestReport,
      aiQuestions: latestQuestions,
      aiGuidance: resultText.textContent,
      createdAt: new Date().toLocaleString(),
    });
    renderSavedReports();
    showMessage('Saved on this computer only for now.', 'success');
  });

  document.querySelector('#clear-saved').addEventListener('click', () => {
    window.BullyStorage.clearSavedReports();
    renderSavedReports();
    showMessage('Saved reports were cleared from this computer.', 'success');
  });

  updateTeacherField();
  renderSavedReports();
})();
