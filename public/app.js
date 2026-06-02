document.addEventListener('DOMContentLoaded', () => {
  // Elements
  const timelineWindow = document.getElementById('timeline-window');
  const timelineCanvas = document.getElementById('timeline-canvas');
  const timelineSvg = document.getElementById('timeline-svg');
  const timelineSvgUnmasked = document.getElementById('timeline-svg-unmasked');
  const timelineElements = document.getElementById('timeline-elements');
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const timelineContainer = document.getElementById('timeline-container');

  // Spotlight and navigation state
  let timelineItems = [];
  let activeIndex = -1;
  let dragMoved = false;
  let finalEventId = null;

  // Dynamic layout calculator based on screen width/height
  function getLayout(windowHeight) {
    const isMobile = window.innerWidth < 600;
    if (isMobile) {
      const cardWidth = 260;
      const colSpacing = 272; // maintaining gap spacing
      const yearGap = 15;
      const startX = 20;
      const colStartPadding = 45;
      const xLabelOffset = 15;

      const usableHeight = windowHeight - 40;
      const centerY = usableHeight / 2;
      const trackOffset = Math.min(100, Math.max(60, usableHeight * 0.1625));
      const track1Y = centerY - trackOffset;
      const track2Y = centerY + trackOffset;

      const cardTop1 = track1Y - 30 - 170; // 30px gap above the track line (assumes card height of 170px)
      const cardTop2 = track2Y + 30;        // 30px gap below the track line
      const cardTopMerged = centerY - 42;   // Centered (card height is 84px)
      const cardHeightMergedMobile = 170;
      const cardTopPostMerge = centerY - (cardHeightMergedMobile / 2);

      return {
        track1Y,
        centerY,
        track2Y,
        cardTop1,
        cardTop2,
        cardTopMerged,
        cardTopPostMerge,
        cardWidth,
        colSpacing,
        yearGap,
        startX,
        colStartPadding,
        xLabelOffset,
        cardGap: 30
      };
    } else {
      const centerY = windowHeight / 2;
      const cardTopMerged = centerY - 57;
      const cardHeightMergedDesktop = 260;
      const cardTopPostMerge = centerY - (cardHeightMergedDesktop / 2);
      const gap = 65;
      const track1Y = cardTopMerged - gap;
      const track2Y = cardTopMerged + 115 + gap;
      const conn = Math.min(45, Math.max(15, (windowHeight - 500) * 0.2)) * 1.2;
      const cardTop1 = track1Y - conn - 181;
      const cardTop2 = track2Y + conn;

      return {
        track1Y,
        centerY,
        track2Y,
        cardTop1,
        cardTop2,
        cardTopMerged,
        cardTopPostMerge,
        cardWidth: 320,
        colSpacing: 335, // maintaining gap spacing
        yearGap: 30,
        startX: 70,
        colStartPadding: 70,
        xLabelOffset: 35,
        cardGap: conn
      };
    }

  }

  // Scope variables for scroll sticky tracking
  let x_meeting = 120;
  let labelCreator = null;
  let labelPersona = null;
  let startX1 = 120;
  let startX2 = 120;
  let labelStart1 = 65;
  let labelStart2 = 65;

  // Date Parsing Helpers
  function getNumericValue(key) {
    if (!key) return 0;
    const str = key.toString().trim();

    // Standard YYYY-MM
    const matchYM = str.match(/^(\d{4})-(\d{2})$/);
    if (matchYM) {
      return parseInt(matchYM[1], 10) + (parseInt(matchYM[2], 10) - 1) / 12;
    }

    // Standard YYYY
    const matchY = str.match(/^(\d{4})$/);
    if (matchY) {
      return parseInt(matchY, 10);
    }

    // English Month/Year e.g., "June 2026"
    const dateParsed = Date.parse(str);
    if (!isNaN(dateParsed)) {
      const dateObj = new Date(dateParsed);
      return dateObj.getFullYear() + dateObj.getMonth() / 12;
    }

    return parseFloat(str) || 0;
  }

  function getDisplayLabel(key) {
    if (!key) return '';
    const str = key.toString().trim();

    // YYYY-MM
    const matchYM = str.match(/^(\d{4})-(\d{2})$/);
    if (matchYM) {
      const year = matchYM[1];
      const month = parseInt(matchYM[2], 10);
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return (months[month - 1] || '') + ' ' + year;
    }

    return str;
  }

  function getMonthInYear(event, groupYear) {
    if (groupYear.includes('-')) return 0;
    const dateStr = event.dateLabel || event.year;
    if (!dateStr) return 0;

    const dateParsed = Date.parse(dateStr);
    if (!isNaN(dateParsed)) {
      return new Date(dateParsed).getMonth();
    }

    const matchYM = dateStr.match(/^\d{4}-(\d{2})$/);
    if (matchYM) {
      return parseInt(matchYM[1], 10) - 1;
    }

    return 0;
  }

  // Helper to determine index of first visible element in timeline viewport
  function getFirstVisibleIndex() {
    const scrollLeft = timelineWindow.scrollLeft;
    let labelWidth = 90;
    if (labelCreator && labelPersona) {
      labelWidth = Math.max(labelCreator.offsetWidth, labelPersona.offsetWidth) || 90;
    }
    const isMobile = window.innerWidth < 600;
    const labelX = Math.max(isMobile ? 15 : 65, scrollLeft + (isMobile ? 10 : 15));
    const maskEnd = labelX + labelWidth + 35;

    const idx = timelineItems.findIndex(item => {
      const rightEdge = item.element.offsetLeft + item.element.offsetWidth;
      return rightEdge > maskEnd;
    });
    return idx !== -1 ? idx : 0;
  }

  // Helper to disable/enable and blur navigation buttons at timeline boundaries
  function updateNavigationButtons() {
    if (timelineItems.length === 0) {
      btnPrev.disabled = true;
      btnNext.disabled = true;
      return;
    }

    if (activeIndex === 0) {
      btnPrev.disabled = true;
      btnPrev.blur();
    } else {
      btnPrev.disabled = false;
    }

    if (activeIndex === timelineItems.length - 1) {
      btnNext.disabled = true;
      btnNext.blur();
    } else {
      btnNext.disabled = false;
    }
  }

  let cachedTimelineData = null;

  // CSV parsing helpers
  function parseTimelineCSV(csvText) {
    const data = { config: {}, events: [] };
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentField += '"';
          i++; // skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i++; // skip \n
        }
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 && currentRow.some(field => field !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some(field => field !== '')) {
        rows.push(currentRow);
      }
    }

    if (rows.length === 0) return data;
    const headers = rows[0];

    for (let i = 1; i < rows.length; i++) {
      const values = rows[i];
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      if (row.Type === 'config') {
        data.config[row.ID] = row.Year;
      } else if (row.Type === 'event') {
        data.events.push({
          id: row.ID,
          year: row.Year,
          track: parseInt(row.Track, 10),
          title: row.Title,
          dateLabel: row['Date Label'] || row.DateLabel,
          description: row.Description
        });
      }
    }

    // Sort events chronologically
    data.events.sort((a, b) => {
      const valA = getNumericValue(a.year);
      const valB = getNumericValue(b.year);
      if (valA !== valB) return valA - valB;
      return a.id.localeCompare(b.id, undefined, { numeric: true, sensitivity: 'base' });
    });

    return data;
  }


  // Fetch timeline.csv directly (works on Netlify static hosting and local Express)
  fetch('/timeline.csv')
    .then(response => response.text())
    .then(csvText => {
      const data = parseTimelineCSV(csvText);
      cachedTimelineData = data;
      renderTimeline(data);
    })
    .catch(error => {
      console.error('Error fetching timeline data:', error);
    });


  // Debounced window resize event listener to trigger renderTimeline with new layout values
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (cachedTimelineData) {
        renderTimeline(cachedTimelineData);
      }
    }, 150);
  });

  function renderTimeline(data) {
    const { config, events } = data;

    // Dynamically set the ID of the final event (the last event in chronological order)
    finalEventId = events.length > 0 ? events[events.length - 1].id : null;

    // Get dynamic layout constants
    const layout = getLayout(timelineWindow.clientHeight);

    // Apply Config Colors to CSS variables
    document.documentElement.style.setProperty('--track1-color', config.track1_color || '#bc0000');
    document.documentElement.style.setProperty('--track2-color', config.track2_color || '#a47e03');
    document.documentElement.style.setProperty('--merged-color', config.merged_color || '#5d5745');
    document.documentElement.style.setProperty('--milestone-color', config.milestone_color || '#007179');

    // Clear previous elements
    timelineElements.innerHTML = '';

    // Clear previous track labels if they exist
    const oldLabels = timelineCanvas.querySelectorAll('.track-label');
    oldLabels.forEach(el => el.remove());

    // Reset spotlight navigation state
    timelineItems = [];
    activeIndex = -1;

    // Create Track Labels (Left Side)
    labelCreator = document.createElement('p');
    labelCreator.className = 'track-label creator';
    labelCreator.textContent = config.track1_label || 'The Creator';
    labelCreator.style.top = `${layout.track1Y - 9}px`;
    timelineCanvas.appendChild(labelCreator);

    labelPersona = document.createElement('p');
    labelPersona.className = 'track-label persona';
    labelPersona.textContent = config.track2_label || 'The Persona';
    labelPersona.style.top = `${layout.track2Y - 7}px`;
    timelineCanvas.appendChild(labelPersona);

    // Group events by 4-digit year
    const eventsByYear = {};
    events.forEach(event => {
      const yearKey = event.year.split('-')[0];
      if (!eventsByYear[yearKey]) {
        eventsByYear[yearKey] = [];
      }
      eventsByYear[yearKey].push(event);
    });

    // Calculate which cards are pre-merge vs post-merge based on the merge boundary IDs
    const mergeAfterId = config.merge_after_event_id || '31';
    const mergeBeforeId = config.merge_before_event_id || '32';
    const mergeAfterIndex = events.findIndex(e => e.id === mergeAfterId);
    const mergeBeforeIndex = events.findIndex(e => e.id === mergeBeforeId);

    events.forEach((event, idx) => {
      if (mergeAfterIndex !== -1) {
        event.isPreMerge = (idx <= mergeAfterIndex);
      } else if (mergeBeforeIndex !== -1) {
        event.isPreMerge = (idx < mergeBeforeIndex);
      } else {
        event.isPreMerge = true;
      }
    });

    // Sort unique 4-digit years chronologically
    const years = Object.keys(eventsByYear).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));

    let xOffset = layout.startX;
    const cardPlacements = [];
    const yearPositions = [];

    // Pre-calculate positions of years and cards
    years.forEach((year) => {
      const yearEvents = eventsByYear[year];

      // Sort all events of the year chronologically
      const sortedEvents = yearEvents.slice().sort((a, b) => {
        const timeA = getNumericValue(a.year);
        const timeB = getNumericValue(b.year);
        return timeA - timeB;
      });

      // Group events into columns where they can share a column if they have the exact same date and different tracks
      const columns = [];
      sortedEvents.forEach(event => {
        const eventTime = getNumericValue(event.year);
        const isPreMergeEvent = event.isPreMerge;
        const eventTrack = isPreMergeEvent ? event.track : 'merged';

        let placed = false;
        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
          const colEvents = columns[colIdx];
          const colTime = getNumericValue(colEvents[0].year);

          const sameTime = Math.abs(eventTime - colTime) < 0.001;
          const trackUsed = colEvents.some(e => {
            const isPreMergeE = e.isPreMerge;
            const t = isPreMergeE ? e.track : 'merged';
            return t === eventTrack;
          });

          if (sameTime && !trackUsed) {
            colEvents.push(event);
            placed = true;
            break;
          }
        }

        if (!placed) {
          columns.push([event]);
        }
      });

      const yearXStart = xOffset;
      const yearPositionsRecord = { year, xStart: yearXStart };
      yearPositionsRecord.xLabel = yearXStart + layout.xLabelOffset;

      // Compute column offsets dynamically using a greedy constraint solver
      const colXOffsets = [];
      const baseSlotSpacing = window.innerWidth < 600 ? 8 : 12; // Highly condensed spacing per month (in pixels)
      const firstColTime = columns.length > 0 ? getNumericValue(columns[0][0].year) : 0;

      columns.forEach((colEvents, colIdx) => {
        const timeI = getNumericValue(colEvents[0].year);
        const t_i = (timeI - firstColTime) * 12; // Time difference in months
        let x_i = t_i * baseSlotSpacing;

        // Verify collision against all previous columns in the same year block
        for (let j = 0; j < colIdx; j++) {
          const prevColEvents = columns[j];
          const timeJ = getNumericValue(prevColEvents[0].year);
          const t_j = (timeJ - firstColTime) * 12;

          // Determine if columns share a track
          let shareTrack = false;
          const isPreMergeEventI = colEvents[0].isPreMerge;
          const isPreMergeEventJ = prevColEvents[0].isPreMerge;

          if (!isPreMergeEventI || !isPreMergeEventJ) {
            shareTrack = true; // post-merge: everything is on the same track (merged)
          } else {
            const tracksI = colEvents.map(e => e.track);
            const tracksJ = prevColEvents.map(e => e.track);
            shareTrack = tracksI.some(t => tracksJ.includes(t));
          }

          const prevContainsWide = prevColEvents.some(e => e.title === 'GenAI Today' || e.id === finalEventId);
          const isMobile = window.innerWidth < 600;
          const currentSpacing = prevContainsWide ? (isMobile ? layout.colSpacing + 30 : layout.colSpacing + 120) : layout.colSpacing;

          if (shareTrack) {
            x_i = Math.max(x_i, colXOffsets[j] + currentSpacing);
          } else {
            x_i = Math.max(x_i, colXOffsets[j] + (t_i - t_j) * baseSlotSpacing);
          }
        }

        colXOffsets.push(x_i);
      });

      const maxOffset = colXOffsets.length > 0 ? colXOffsets[colXOffsets.length - 1] : 0;

      // Render columns
      columns.forEach((colEvents, colIdx) => {
        const colX = yearXStart + layout.colStartPadding + colXOffsets[colIdx];
        const centerPos = colX + layout.cardWidth / 2;

        colEvents.forEach(event => {
          let element;
          const isPreMergeEvent = event.isPreMerge;
          if (isPreMergeEvent) {
            if (event.track === 3) {
              // Track 3 Card (Milestone)
              element = renderCard(event, colX, layout.cardTopMerged, 3);
              element.classList.add('pre-merge-tech');
              cardPlacements.push({ element, track: 3, x: colX, y: layout.cardTopMerged, isPreMerge: event.isPreMerge, id: event.id });
              timelineItems.push({
                element,
                type: 'card',
                centerX: centerPos,
                dateValue: getNumericValue(event.year),
                track: 3
              });
            } else if (event.track === 1) {
              // Track 1 Card
              element = renderCard(event, colX, null, 1, layout.track1Y - layout.cardGap);
              cardPlacements.push({ element, track: 1, x: colX, y: layout.cardTop1, isPreMerge: event.isPreMerge, id: event.id });
              timelineItems.push({
                element,
                type: 'card',
                centerX: centerPos,
                dateValue: getNumericValue(event.year),
                track: 1
              });
            } else if (event.track === 2) {
              // Track 2 Card
              element = renderCard(event, colX, layout.cardTop2, 2);
              cardPlacements.push({ element, track: 2, x: colX, y: layout.cardTop2, isPreMerge: event.isPreMerge, id: event.id });
              timelineItems.push({
                element,
                type: 'card',
                centerX: centerPos,
                dateValue: getNumericValue(event.year),
                track: 2
              });
            }
          } else {
            // Merged Card
            if (event.track === 3) {
              element = renderCard(event, colX, layout.cardTopMerged, 3);
              if (event.title === "Sora Shut Down") {
                element.classList.add('pre-merge-tech');
              }
              cardPlacements.push({ element, track: 3, x: colX, y: layout.cardTopMerged, isPreMerge: event.isPreMerge, id: event.id });
              timelineItems.push({
                element,
                type: 'card',
                centerX: centerPos,
                dateValue: getNumericValue(event.year),
                track: 3
              });
            } else {
              element = renderCard(event, colX, layout.cardTopPostMerge, 'merged');
              cardPlacements.push({ element, track: 'merged', x: colX, y: layout.cardTopPostMerge, isPreMerge: event.isPreMerge, id: event.id });
              timelineItems.push({
                element,
                type: 'card',
                centerX: centerPos,
                dateValue: getNumericValue(event.year),
                track: 'merged'
              });
            }
          }

          if (event.id === finalEventId) {
            element.style.bottom = 'auto';
          }

        });
      });

      let yearWidth = layout.colStartPadding + maxOffset + layout.colSpacing;
      const yearXEnd = yearXStart + yearWidth;
      yearPositionsRecord.xEnd = yearXEnd;
      yearPositions.push(yearPositionsRecord);

      // Render Year Label (Axis indicator)
      renderYearLabel(getDisplayLabel(year), yearPositionsRecord.xLabel, layout.centerY);

      // Advance xOffset for the next year
      xOffset = yearXEnd + layout.yearGap;
    });

    // Sort timeline items chronologically
    timelineItems.sort((a, b) => {
      if (Math.abs(a.dateValue - b.dateValue) > 0.001) {
        return a.dateValue - b.dateValue;
      }
      if (Math.abs(a.centerX - b.centerX) > 0.1) {
        return a.centerX - b.centerX;
      }
      const trackPriority = (t) => {
        if (t === 1) return 1;
        if (t === 3) return 2;
        if (t === 2) return 3;
        return 4; // 'merged'
      };
      return trackPriority(a.track) - trackPriority(b.track);
    });

    // Calculate canvas width with padding at the end
    const canvasWidth = Math.max(xOffset + 300, window.innerWidth);
    timelineCanvas.style.width = `${canvasWidth}px`;

    // Determine the merge point based on the specific merge cards
    const preMergePlacements = cardPlacements.filter(p => p.isPreMerge && (p.track === 1 || p.track === 2));
    const postMergePlacements = cardPlacements.filter(p => !p.isPreMerge);

    const afterPlacement = cardPlacements.find(p => p.id === mergeAfterId);
    const beforePlacement = cardPlacements.find(p => p.id === mergeBeforeId);

    let x_pre_merge_end = layout.startX;
    let x_post_merge_start = canvasWidth;

    if (afterPlacement) {
      x_pre_merge_end = afterPlacement.x + layout.cardWidth;
    } else if (preMergePlacements.length > 0) {
      x_pre_merge_end = Math.max(...preMergePlacements.map(p => p.x + layout.cardWidth));
    }

    if (beforePlacement) {
      x_post_merge_start = beforePlacement.x;
    } else if (postMergePlacements.length > 0) {
      x_post_merge_start = Math.min(...postMergePlacements.map(p => p.x));
    }

    if (x_pre_merge_end > layout.startX && x_post_merge_start < canvasWidth) {
      x_meeting = (x_pre_merge_end + x_post_merge_start) / 2;
    } else if (x_post_merge_start < canvasWidth) {
      x_meeting = layout.startX;
    } else {
      x_meeting = canvasWidth;
    }

    // Set outer-scope track start coordinates dynamically 100px before the first pre-merge card
    const p1 = cardPlacements.find(p => p.isPreMerge && p.track === 1);
    const firstCardX1 = p1 ? p1.x : layout.startX;
    startX1 = firstCardX1 - 100;

    const p2 = cardPlacements.find(p => p.isPreMerge && p.track === 2);
    const firstCardX2 = p2 ? p2.x : layout.startX;
    startX2 = firstCardX2 - 100;

    const finalCardPlacement = cardPlacements.find(p => p.id === finalEventId);
    const x_line_end = finalCardPlacement ? (finalCardPlacement.x + layout.cardWidth) : canvasWidth;

    const isMobile = window.innerWidth < 600;
    const initialLabelX = isMobile ? 15 : 65;
    const labelLeftOffset = layout.startX - initialLabelX;
    labelStart1 = startX1 - labelLeftOffset;
    labelStart2 = startX2 - labelLeftOffset;

    // Clean up any existing observer if we are re-rendering
    if (window.timelineResizeObserver) {
      window.timelineResizeObserver.disconnect();
    }

    // Now render SVG tracks and connectors (needs cards loaded in DOM to measure heights)
    const initDraw = () => {
      // Center Track 3 cards and the final card vertically based on their actual offsetHeight
      cardPlacements.forEach(p => {
        if (p.track === 3 || p.id === finalEventId) {
          const h = p.element.offsetHeight;
          p.element.style.top = `${layout.centerY - h / 2}px`;
          p.element.style.bottom = 'auto';
        }
      });

      drawSVGTracks(layout, x_line_end, x_pre_merge_end, x_meeting, preMergePlacements.length > 0, postMergePlacements.length > 0);
      drawCardConnectors(layout, cardPlacements);
      updateStickyLabelsAndMask();
    };

    // Use ResizeObserver to ensure connectors are drawn with the correct size after layout/fonts load
    const observer = new ResizeObserver(() => {
      initDraw();
    });
    cardPlacements.forEach(p => {
      observer.observe(p.element);
    });
    window.timelineResizeObserver = observer;

    requestAnimationFrame(initDraw);

    // Initial navigation buttons state update
    updateNavigationButtons();
  }

  // Card Rendering Helper
  function renderCard(event, x, y, trackType, bottomVal) {
    const card = document.createElement('div');
    card.className = `timeline-card track-${trackType}`;
    if (event.id === finalEventId) {
      card.classList.add('final-card');
    }
    if (event.title === 'GenAI Today') {
      card.classList.add('final-card', 'pre-merge-tech');
    }
    card.style.left = `${x}px`;
    if (bottomVal !== undefined && bottomVal !== null) {
      card.style.bottom = `calc(100% - ${bottomVal}px)`;
    } else {
      card.style.top = `${y}px`;
    }

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = event.title;
    card.appendChild(title);

    const date = document.createElement('p');
    date.className = 'card-date';
    date.textContent = event.dateLabel;
    card.appendChild(date);

    const desc = document.createElement('p');
    desc.className = 'card-description';
    desc.innerHTML = event.description;
    card.appendChild(desc);

    timelineElements.appendChild(card);
    return card;
  }

  // Year Label Rendering Helper
  function renderYearLabel(displayLabel, x, centerYVal) {
    const label = document.createElement('div');
    label.className = 'year-label';
    label.style.left = `${x}px`;
    label.style.top = `${centerYVal}px`;
    label.textContent = displayLabel;

    timelineElements.appendChild(label);
  }

  // Draw Background tracks inside SVG
  function drawSVGTracks(layout, canvasWidth, x_pre_merge_end, x_meeting, hasPreMerge, hasPostMerge) {
    let maskedSvgContent = '';
    let unmaskedSvgContent = '';

    // Defs with track-specific gradients and masks
    maskedSvgContent += `
      <defs>
        <linearGradient id="track1-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="0">
          <stop offset="0%" stop-color="white" stop-opacity="0"/>
          <stop offset="100%" stop-color="white" stop-opacity="1"/>
        </linearGradient>
        <mask id="track1-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
          <rect x="0" y="0" width="100%" height="100%" fill="url(#track1-grad)"/>
        </mask>
        <linearGradient id="track2-grad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="0">
          <stop offset="0%" stop-color="white" stop-opacity="0"/>
          <stop offset="100%" stop-color="white" stop-opacity="1"/>
        </linearGradient>
        <mask id="track2-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
          <rect x="0" y="0" width="100%" height="100%" fill="url(#track2-grad)"/>
        </mask>
      </defs>
    `;

    // 1. Dash-line year track (Central timeline) - Unmasked
    if (hasPreMerge) {
      unmaskedSvgContent += `
        <path d="M ${layout.startX} ${layout.centerY} L ${x_meeting} ${layout.centerY}"
              stroke="var(--text-light-gray)"
              stroke-dasharray="4,4"
              stroke-width="2"
              fill="none"/>
      `;
    }

    // 2. Track 1 (Top, Red) - Masked, starts at startX1
    if (hasPreMerge) {
      maskedSvgContent += `
        <circle cx="${startX1}" cy="${layout.track1Y}" r="4" fill="var(--track1-color)" mask="url(#track1-mask)"/>
        <path d="M ${startX1} ${layout.track1Y} L ${x_pre_merge_end} ${layout.track1Y} L ${x_meeting} ${layout.centerY - 1.5}"
              stroke="var(--track1-color)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
              mask="url(#track1-mask)"/>
      `;
    }

    // 3. Track 2 (Bottom, Gold) - Masked, starts at startX2
    if (hasPreMerge) {
      maskedSvgContent += `
        <circle cx="${startX2}" cy="${layout.track2Y}" r="4" fill="var(--track2-color)" mask="url(#track2-mask)"/>
        <path d="M ${startX2} ${layout.track2Y} L ${x_pre_merge_end} ${layout.track2Y} L ${x_meeting} ${layout.centerY + 1.5}"
              stroke="var(--track2-color)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"
              mask="url(#track2-mask)"/>
      `;
    }

    // 4. Merged Track (Dual-colored: Red & Gold parallel threads) - Unmasked
    if (hasPostMerge) {
      unmaskedSvgContent += `
        <path d="M ${x_meeting} ${layout.centerY - 1.5} L ${canvasWidth} ${layout.centerY - 1.5}"
              stroke="var(--track1-color)"
              stroke-width="2"
              stroke-linecap="round"
              fill="none"/>
        <path d="M ${x_meeting} ${layout.centerY + 1.5} L ${canvasWidth} ${layout.centerY + 1.5}"
              stroke="var(--track2-color)"
              stroke-width="2"
              stroke-linecap="round"
              fill="none"/>
      `;
    }

    timelineSvg.innerHTML = maskedSvgContent;
    timelineSvgUnmasked.innerHTML = unmaskedSvgContent;
  }

  // Draw Card Connector Lines
  function drawCardConnectors(layout, placements) {
    let svgLines = '';

    placements.forEach(p => {
      const h = p.element.offsetHeight;
      const w = p.element.offsetWidth;
      const cx = p.x + w / 2;
      const actualTop = p.element.offsetTop;

      if (p.track === 1) {
        svgLines += `
          <line x1="${cx}" y1="${actualTop + h}" x2="${cx}" y2="${layout.track1Y}"
                stroke="var(--track1-color)"
                stroke-width="1.5"
                mask="url(#track1-mask)"/>
        `;
      } else if (p.track === 2) {
        svgLines += `
          <line x1="${cx}" y1="${actualTop}" x2="${cx}" y2="${layout.track2Y}"
                stroke="var(--track2-color)"
                stroke-width="1.5"
                mask="url(#track2-mask)"/>
        `;
      }
    });

    timelineSvg.innerHTML += svgLines;
  }

  // Sticky Track Label & Mask Update Handler
  function updateStickyLabelsAndMask() {
    if (labelCreator && labelPersona) {
      const scrollLeft = timelineWindow.scrollLeft;
      const isMobile = window.innerWidth < 600;

      const labelLeft = isMobile ? 10 : 15;
      const limitOffset = isMobile ? 100 : 150;

      // Calculate independent sticky X for Track 1
      let label1X = Math.max(labelStart1, scrollLeft + labelLeft);
      label1X = Math.min(label1X, x_meeting - limitOffset);

      // Calculate independent sticky X for Track 2
      let label2X = Math.max(labelStart2, scrollLeft + labelLeft);
      label2X = Math.min(label2X, x_meeting - limitOffset);

      // Position the DOM labels
      labelCreator.style.left = `${label1X}px`;
      labelPersona.style.left = `${label2X}px`;

      const label1Width = labelCreator.offsetWidth || 90;
      const label2Width = labelPersona.offsetWidth || 90;

      // Update SVG mask coordinates dynamically
      let x1_1 = label1X + label1Width + 5;
      let x2_1 = label1X + label1Width + 35;
      if (x1_1 <= startX1) {
        x1_1 = 0;
        x2_1 = 0;
      }

      let x1_2 = label2X + label2Width + 5;
      let x2_2 = label2X + label2Width + 35;
      if (x1_2 <= startX2) {
        x1_2 = 0;
        x2_2 = 0;
      }

      const grad1 = document.getElementById('track1-grad');
      if (grad1) {
        grad1.setAttribute('x1', x1_1.toString());
        grad1.setAttribute('x2', x2_1.toString());
      }

      const grad2 = document.getElementById('track2-grad');
      if (grad2) {
        grad2.setAttribute('x1', x1_2.toString());
        grad2.setAttribute('x2', x2_2.toString());
      }
    }
  }

  // Centering & Spotlight Highlighting Helper
  function scrollToAndHighlight(index) {
    // Remove highlighted class from all items
    timelineItems.forEach(item => {
      item.element.classList.remove('highlighted');
    });

    if (index >= 0 && index < timelineItems.length) {
      activeIndex = index;
      const activeItem = timelineItems[activeIndex];

      // Highlight current item
      activeItem.element.classList.add('highlighted');
      timelineElements.classList.add('has-highlighted');

      // Calculate centering scroll position
      const viewportWidth = timelineWindow.clientWidth;
      let itemCenter = activeItem.element.offsetLeft;
      if (activeItem.type === 'card') {
        itemCenter += activeItem.element.offsetWidth / 2;
      }

      const targetScrollLeft = itemCenter - viewportWidth / 2;

      timelineWindow.scroll({
        left: targetScrollLeft,
        behavior: 'smooth'
      });
    } else {
      activeIndex = -1;
      timelineElements.classList.remove('has-highlighted');
    }

    updateNavigationButtons();
  }

  // --- INTERACTIVITY HANDLERS ---

  // 1. Scroll events (covers drag-to-scroll, smooth navigation, wheel scroll)
  timelineWindow.addEventListener('scroll', updateStickyLabelsAndMask);

  // 2. Drag to Scroll (Mouse)
  let isDown = false;
  let startMouseX;
  let startMouseY;
  let scrollStartLeft;

  timelineWindow.addEventListener('mousedown', (e) => {
    // If the click starts inside a card, let the browser handle standard text selection/clicks inside it
    if (e.target.closest('.timeline-card')) {
      isDown = true;
      dragMoved = false;
      startMouseX = e.pageX;
      startMouseY = e.pageY;
      scrollStartLeft = timelineWindow.scrollLeft;
      return;
    }

    isDown = true;
    dragMoved = false;
    timelineWindow.style.cursor = 'grabbing';
    startMouseX = e.pageX;
    startMouseY = e.pageY;
    scrollStartLeft = timelineWindow.scrollLeft;
    
    // Prevent default browser action (like starting text selection)
    e.preventDefault();
  });

  timelineWindow.addEventListener('mouseleave', () => {
    isDown = false;
    timelineWindow.style.cursor = 'grab';
  });

  timelineWindow.addEventListener('mouseup', () => {
    isDown = false;
    timelineWindow.style.cursor = 'grab';
  });

  timelineWindow.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX;
    const y = e.pageY;

    // Check if user dragged beyond threshold (5px)
    const dist = Math.sqrt((x - startMouseX) ** 2 + (y - startMouseY) ** 2);
    if (dist > 5) {
      dragMoved = true;
    }

    const walk = (x - startMouseX) * 1.5;
    timelineWindow.scrollLeft = scrollStartLeft - walk;
  });

  // 2b. Touch to Scroll (Touchscreen) with momentum/inertia
  let touchStartX = 0;
  let touchStartY = 0;
  let isScrollingHorizontal = false;
  let isScrollingVertical = false;
  let touchScrollStart = 0;
  let touchVelocity = 0;
  let lastTouchX = 0;
  let lastTouchTime = 0;
  let momentumRafId = null;

  function cancelMomentum() {
    if (momentumRafId !== null) {
      cancelAnimationFrame(momentumRafId);
      momentumRafId = null;
    }
  }

  function runMomentum() {
    if (Math.abs(touchVelocity) < 0.5) {
      momentumRafId = null;
      return;
    }
    timelineWindow.scrollLeft += touchVelocity;
    touchVelocity *= 0.92; // friction
    momentumRafId = requestAnimationFrame(runMomentum);
  }

  timelineWindow.addEventListener('touchstart', (e) => {
    cancelMomentum();
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchScrollStart = timelineWindow.scrollLeft;
    lastTouchX = touch.clientX;
    lastTouchTime = Date.now();
    touchVelocity = 0;
    dragMoved = false;
    isScrollingHorizontal = false;
    isScrollingVertical = false;
  }, { passive: true });

  timelineWindow.addEventListener('touchmove', (e) => {
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Lock scrolling direction once threshold is reached
    if (!isScrollingHorizontal && !isScrollingVertical) {
      if (absDx > 8 && absDx > absDy) {
        isScrollingHorizontal = true;
      } else if (absDy > 8 && absDy > absDx) {
        isScrollingVertical = true;
      }
    }

    // If it's a vertical scroll gesture, do not move the horizontal timeline
    if (isScrollingVertical) {
      return;
    }

    if (isScrollingHorizontal) {
      if (absDx > 5) dragMoved = true;

      // Track velocity from recent movement
      const now = Date.now();
      const dt = now - lastTouchTime;
      if (dt > 0) {
        touchVelocity = -(touch.clientX - lastTouchX) / dt * 16;
      }
      lastTouchX = touch.clientX;
      lastTouchTime = now;

      timelineWindow.scrollLeft = touchScrollStart - dx;
    }
  }, { passive: true });

  timelineWindow.addEventListener('touchend', () => {
    // Only kick off momentum scroll if we were actually horizontal scrolling
    if (isScrollingHorizontal) {
      momentumRafId = requestAnimationFrame(runMomentum);
    }
  }, { passive: true });

  timelineWindow.addEventListener('touchcancel', () => {
    cancelMomentum();
  }, { passive: true });

  // 3. Mouse Wheel horizontal translation
  timelineWindow.addEventListener('wheel', (e) => {
    // Only capture horizontal scrolls (trackpad swipes)
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && e.deltaX !== 0) {
      e.preventDefault();
      timelineWindow.scrollLeft += e.deltaX;
    }
    // Ignore vertical scrolls (mouse wheels), allowing the native page to scroll
  }, { passive: false });

  // 4. Navigation Buttons (Arrows) - Sequential Pinning
  btnPrev.addEventListener('click', () => {
    if (timelineItems.length === 0) return;

    let newIndex;
    if (activeIndex === -1) {
      newIndex = getFirstVisibleIndex();
    } else {
      newIndex = activeIndex - 1;
      if (newIndex < 0) {
        return; // Don't cycle
      }
    }
    scrollToAndHighlight(newIndex);
  });

  btnNext.addEventListener('click', () => {
    if (timelineItems.length === 0) return;

    let newIndex;
    if (activeIndex === -1) {
      newIndex = getFirstVisibleIndex();
    } else {
      newIndex = activeIndex + 1;
      if (newIndex >= timelineItems.length) {
        return; // Don't cycle
      }
    }
    scrollToAndHighlight(newIndex);
  });

  // 5. Canvas Click Delegation (Direct item clicks and background clears)
  timelineCanvas.addEventListener('click', (e) => {
    // If the user was dragging to scroll, ignore click selection
    if (dragMoved) return;

    const targetEl = e.target.closest('.timeline-card');

    if (targetEl) {
      const idx = timelineItems.findIndex(item => item.element === targetEl);
      if (idx !== -1) {
        scrollToAndHighlight(idx);
      }
    } else {
      // Clicked on empty background, clear focus spotlight
      scrollToAndHighlight(-1);
    }
  });

  // 5. Fullscreen Control
  btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      timelineContainer.requestFullscreen()
        .then(() => {
          timelineContainer.classList.add('fullscreen');
        })
        .catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
    } else {
      document.exitFullscreen()
        .then(() => {
          timelineContainer.classList.remove('fullscreen');
        });
    }
  });

  // Sync state if user exits fullscreen via ESC key
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      timelineContainer.classList.remove('fullscreen');
    } else {
      timelineContainer.classList.add('fullscreen');
    }
  });

  // 6. Keyboard navigation (ArrowLeft and ArrowRight keys)
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (timelineItems.length === 0) return;

      let newIndex;
      if (activeIndex === -1) {
        newIndex = getFirstVisibleIndex();
      } else {
        newIndex = activeIndex - 1;
        if (newIndex < 0) {
          return; // Don't cycle
        }
      }
      scrollToAndHighlight(newIndex);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (timelineItems.length === 0) return;

      let newIndex;
      if (activeIndex === -1) {
        newIndex = getFirstVisibleIndex();
      } else {
        newIndex = activeIndex + 1;
        if (newIndex >= timelineItems.length) {
          return; // Don't cycle
        }
      }
      scrollToAndHighlight(newIndex);
    }
  });
});
