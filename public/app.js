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

  // Dynamic layout calculator based on screen width/height
  function getLayout(windowHeight) {
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      const cardWidth = 230;
      const colSpacing = 255;
      const yearGap = 40;
      const startX = 80;
      const colStartPadding = 90;
      const xLabelOffset = 25;

      const usableHeight = windowHeight - 40;
      const centerY = 20 + usableHeight / 2;
      const trackOffset = Math.min(105, Math.max(82, usableHeight * 0.16));
      const track1Y = centerY - trackOffset;
      const track2Y = centerY + trackOffset;
      
      const cardTop1 = 10;
      const cardTop2 = centerY + trackOffset + Math.min(50, Math.max(30, usableHeight * 0.06));
      const cardTopMerged = centerY - 57;

      return {
        track1Y,
        centerY,
        track2Y,
        cardTop1,
        cardTop2,
        cardTopMerged,
        cardWidth,
        colSpacing,
        yearGap,
        startX,
        colStartPadding,
        xLabelOffset
      };
    } else {
      return {
        track1Y: 210,
        centerY: 323,
        track2Y: 436,
        cardTop1: 20,
        cardTop2: 445,
        cardTopMerged: 265,
        cardWidth: 232,
        colSpacing: 262,
        yearGap: 50,
        startX: 120,
        colStartPadding: 110,
        xLabelOffset: 35
      };
    }
  }

  // Scope variables for scroll sticky tracking
  let x_meeting = 120;
  let labelCreator = null;
  let labelPersona = null;

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
    const isMobile = window.innerWidth < 768;
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

  // Fetch timeline data from Node API
  fetch('/api/timeline')
    .then(response => response.json())
    .then(data => {
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

    // Group events by year/date string
    const eventsByYear = {};
    events.forEach(event => {
      if (!eventsByYear[event.year]) {
        eventsByYear[event.year] = [];
      }
      eventsByYear[event.year].push(event);
    });

    // Sort unique years/dates chronologically
    const years = Object.keys(eventsByYear).sort((a, b) => getNumericValue(a) - getNumericValue(b));
    const mergeVal = getNumericValue(config.merge_year || '2022');

    let xOffset = layout.startX;
    const cardPlacements = [];
    const yearPositions = [];

    // Pre-calculate positions of years and cards
    years.forEach((year) => {
      const yearEvents = eventsByYear[year];
      const isPreMerge = getNumericValue(year) < mergeVal;

      // Sort all events of the year chronologically
      const sortedEvents = yearEvents.slice().sort((a, b) => {
        const timeA = getNumericValue(a.dateLabel || a.year);
        const timeB = getNumericValue(b.dateLabel || b.year);
        return timeA - timeB;
      });

      // Group events into columns where they can share a column if they have the exact same date and different tracks
      const columns = [];
      sortedEvents.forEach(event => {
        const eventTime = getNumericValue(event.dateLabel || event.year);
        const eventTrack = isPreMerge ? event.track : 'merged';

        let placed = false;
        for (let colIdx = 0; colIdx < columns.length; colIdx++) {
          const colEvents = columns[colIdx];
          const colTime = getNumericValue(colEvents[0].dateLabel || colEvents[0].year);

          const sameTime = Math.abs(eventTime - colTime) < 0.001;
          const trackUsed = colEvents.some(e => {
            const t = isPreMerge ? e.track : 'merged';
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
      const baseSlotSpacing = window.innerWidth < 768 ? 25 : 35; // Spacing per month (in pixels)
      const firstColTime = columns.length > 0 ? getMonthInYear(columns[0][0], year) : 0;

      columns.forEach((colEvents, colIdx) => {
        const t_i = getMonthInYear(colEvents[0], year) - firstColTime;
        let x_i = t_i * baseSlotSpacing;

        // Verify collision against all previous columns in the same year block
        for (let j = 0; j < colIdx; j++) {
          const prevColEvents = columns[j];
          const t_j = getMonthInYear(prevColEvents[0], year) - firstColTime;

          // Determine if columns share a track
          let shareTrack = false;
          if (!isPreMerge) {
            shareTrack = true; // post-merge: everything is on the same track
          } else {
            const tracksI = colEvents.map(e => e.track);
            const tracksJ = prevColEvents.map(e => e.track);
            shareTrack = tracksI.some(t => tracksJ.includes(t));
          }

          if (shareTrack) {
            x_i = Math.max(x_i, colXOffsets[j] + layout.colSpacing);
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
          if (isPreMerge) {
            if (event.track === 3) {
              // Track 3 Card (Milestone)
              element = renderCard(event, colX, layout.cardTopMerged, 3);
              cardPlacements.push({ element, track: 3, x: colX, y: layout.cardTopMerged });
              timelineItems.push({
                element,
                type: 'card',
                centerX: centerPos,
                dateValue: getNumericValue(event.dateLabel || event.year),
                track: 3
              });
            } else if (event.track === 1) {
              // Track 1 Card
              element = renderCard(event, colX, layout.cardTop1, 1);
              cardPlacements.push({ element, track: 1, x: colX, y: layout.cardTop1 });
              timelineItems.push({
                element,
                type: 'card',
                centerX: centerPos,
                dateValue: getNumericValue(event.dateLabel || event.year),
                track: 1
              });
            } else if (event.track === 2) {
              // Track 2 Card
              element = renderCard(event, colX, layout.cardTop2, 2);
              cardPlacements.push({ element, track: 2, x: colX, y: layout.cardTop2 });
              timelineItems.push({
                element,
                type: 'card',
                centerX: centerPos,
                dateValue: getNumericValue(event.dateLabel || event.year),
                track: 2
              });
            }
          } else {
            // Merged Card
            element = renderCard(event, colX, layout.cardTopMerged, 'merged');
            cardPlacements.push({ element, track: 'merged', x: colX, y: layout.cardTopMerged });
            timelineItems.push({
              element,
              type: 'card',
              centerX: centerPos,
              dateValue: getNumericValue(event.dateLabel || event.year),
              track: 'merged'
            });
          }
        });
      });

      let yearWidth = layout.colStartPadding + maxOffset + layout.colSpacing;
      if (yearEvents.length === 1) {
        yearWidth = Math.max(yearWidth, layout.cardWidth * 2.5);
      }
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
    const canvasWidth = Math.max(xOffset, window.innerWidth);
    timelineCanvas.style.width = `${canvasWidth}px`;

    // Determine the merge point
    const preMergeYears = yearPositions.filter(yp => getNumericValue(yp.year) < mergeVal);
    const postMergeYears = yearPositions.filter(yp => getNumericValue(yp.year) >= mergeVal);
    
    let x_pre_merge_end = layout.startX;
    let x_post_merge_start = canvasWidth;

    if (preMergeYears.length > 0) {
      x_pre_merge_end = preMergeYears[preMergeYears.length - 1].xEnd;
    }
    
    if (postMergeYears.length > 0) {
      x_post_merge_start = postMergeYears[0].xStart;
    }

    if (preMergeYears.length > 0 && postMergeYears.length > 0) {
      x_meeting = (x_pre_merge_end + x_post_merge_start) / 2;
    } else if (postMergeYears.length > 0) {
      x_meeting = layout.startX;
    } else {
      x_meeting = canvasWidth;
    }

    // Clean up any existing observer if we are re-rendering
    if (window.timelineResizeObserver) {
      window.timelineResizeObserver.disconnect();
    }

    // Now render SVG tracks and connectors (needs cards loaded in DOM to measure heights)
    const initDraw = () => {
      drawSVGTracks(layout, canvasWidth, x_pre_merge_end, x_meeting, preMergeYears.length > 0, postMergeYears.length > 0);
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
  function renderCard(event, x, y, trackType) {
    const card = document.createElement('div');
    card.className = `timeline-card track-${trackType}`;
    card.style.left = `${x}px`;
    card.style.top = `${y}px`;

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
    desc.textContent = event.description;
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

    // 2. Track 1 (Top, Red) - Masked
    if (hasPreMerge) {
      maskedSvgContent += `
        <circle cx="${layout.startX}" cy="${layout.track1Y}" r="4" fill="var(--track1-color)"/>
        <path d="M ${layout.startX} ${layout.track1Y} L ${x_pre_merge_end} ${layout.track1Y} L ${x_meeting} ${layout.centerY}"
              stroke="var(--track1-color)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"/>
      `;
    }

    // 3. Track 2 (Bottom, Gold) - Masked
    if (hasPreMerge) {
      maskedSvgContent += `
        <circle cx="${layout.startX}" cy="${layout.track2Y}" r="4" fill="var(--track2-color)"/>
        <path d="M ${layout.startX} ${layout.track2Y} L ${x_pre_merge_end} ${layout.track2Y} L ${x_meeting} ${layout.centerY}"
              stroke="var(--track2-color)"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              fill="none"/>
      `;
    }

    // 4. Merged Track (Grey/Brown) - Unmasked
    if (hasPostMerge) {
      unmaskedSvgContent += `
        <path d="M ${x_meeting} ${layout.centerY} L ${canvasWidth - 100} ${layout.centerY}"
              stroke="var(--merged-color)"
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

      if (p.track === 1) {
        svgLines += `
          <line x1="${cx}" y1="${p.y + h}" x2="${cx}" y2="${layout.track1Y}"
                stroke="var(--track1-color)"
                stroke-width="1.5"/>
        `;
      } else if (p.track === 2) {
        svgLines += `
          <line x1="${cx}" y1="${p.y}" x2="${cx}" y2="${layout.track2Y}"
                stroke="var(--track2-color)"
                stroke-width="1.5"/>
        `;
      }
    });

    timelineSvg.innerHTML += svgLines;
  }

  // Sticky Track Label & Mask Update Handler
  function updateStickyLabelsAndMask() {
    if (labelCreator && labelPersona) {
      const scrollLeft = timelineWindow.scrollLeft;
      // Starts closer on mobile (15px/10px) vs desktop (65px/15px),
      // and capped relative to x_meeting.
      const isMobile = window.innerWidth < 768;
      let labelX = Math.max(isMobile ? 15 : 65, scrollLeft + (isMobile ? 10 : 15));
      labelX = Math.min(labelX, x_meeting - (isMobile ? 100 : 150));
      
      labelCreator.style.left = `${labelX}px`;
      labelPersona.style.left = `${labelX}px`;
      
      // Measure actual label width dynamically to support different localized/configured text lengths
      const labelWidth = Math.max(labelCreator.offsetWidth, labelPersona.offsetWidth) || 90;
      
      // Sync mask positions with label positions (fades out right after the label edge)
      const maskStart = labelX + labelWidth + 5;
      const maskEnd = labelX + labelWidth + 35;
      
      timelineCanvas.style.setProperty('--mask-start', `${maskStart}px`);
      timelineCanvas.style.setProperty('--mask-end', `${maskEnd}px`);
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

  // 2. Drag to Scroll
  let isDown = false;
  let startMouseX;
  let startMouseY;
  let scrollStartLeft;

  timelineWindow.addEventListener('mousedown', (e) => {
    isDown = true;
    dragMoved = false;
    timelineWindow.style.cursor = 'grabbing';
    startMouseX = e.pageX;
    startMouseY = e.pageY;
    scrollStartLeft = timelineWindow.scrollLeft;
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

  // 3. Mouse Wheel horizontal translation
  timelineWindow.addEventListener('wheel', (e) => {
    if (e.deltaY !== 0) {
      e.preventDefault();
      timelineWindow.scrollLeft += e.deltaY * 0.8;
    }
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
});
