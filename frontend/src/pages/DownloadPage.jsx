import { useState } from 'react';

const APK_URL = 'https://github.com/Fazilomar/Mathify/releases/latest/download/mathify-debug.apk';

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function DownloadPage() {
  const [showIosHelp, setShowIosHelp] = useState(() => {
    const dismissed = window.localStorage.getItem('mathify-ios-install-help-dismissed');
    return isIosDevice() && !dismissed && !window.navigator.standalone;
  });

  const dismissIosHelp = () => {
    setShowIosHelp(false);
    window.localStorage.setItem('mathify-ios-install-help-dismissed', 'true');
  };

  return (
    <section className="download-page" aria-labelledby="download-title">
      <div className="download-hero">
        <p className="eyebrow">Mathify anywhere</p>
        <h1 id="download-title">Take your mathematics with you.</h1>
        <p className="download-lede">
          Install the Android app from the latest public release, or add Mathify to your
          iPhone home screen as a fast, full-screen web app.
        </p>
        <div className="download-actions">
          <a className="btn-primary download-button" href={APK_URL} download>
            Download Android APK
          </a>
          <button className="btn-secondary download-button" type="button" onClick={() => setShowIosHelp(true)}>
            Install on iPhone
          </button>
        </div>
        <p className="download-note">Android downloads come from GitHub Releases. The APK is unsigned for direct sideloading.</p>
      </div>

      <div className="download-guides">
        <article className="download-guide">
          <span className="download-step">01</span>
          <h2>Android APK</h2>
          <ol>
            <li>Download the APK, then open it from your browser or Downloads.</li>
            <li>When Android asks, allow your browser to install unknown apps.</li>
            <li>Review the permission prompt and install Mathify. Keep Play Protect enabled.</li>
          </ol>
        </article>
        <article className="download-guide">
          <span className="download-step">02</span>
          <h2>iPhone and iPad</h2>
          <ol>
            <li>Open Mathify in Safari.</li>
            <li>Tap Share, then choose Add to Home Screen.</li>
            <li>Tap Add. Mathify will launch from your home screen like an app.</li>
          </ol>
        </article>
      </div>

      {showIosHelp && (
        <div className="install-modal" role="presentation" onClick={dismissIosHelp}>
          <div className="install-dialog" role="dialog" aria-modal="true" aria-labelledby="ios-install-title" onClick={(event) => event.stopPropagation()}>
            <button className="btn-icon install-close" type="button" aria-label="Close installation help" onClick={dismissIosHelp}>×</button>
            <p className="eyebrow">Safari installation</p>
            <h2 id="ios-install-title">Add Mathify to your Home Screen</h2>
            <p>In Safari, tap the Share button, swipe up if needed, choose Add to Home Screen, then tap Add.</p>
            <button className="btn-primary install-confirm" type="button" onClick={dismissIosHelp}>Got it</button>
          </div>
        </div>
      )}
    </section>
  );
}