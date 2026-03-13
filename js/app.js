// ============================================================
// 사주풀이 웹 앱 - UI 로직
// ============================================================

const App = (() => {
    let members = [];
    let readings = {};

    function init() {
        document.getElementById('addPersonBtn').addEventListener('click', showPersonForm);
        document.getElementById('personForm').addEventListener('submit', handleFormSubmit);
        document.getElementById('cancelBtn').addEventListener('click', hidePersonForm);
        document.getElementById('compareBtn').addEventListener('click', showCompareModal);
        document.getElementById('familyBtn').addEventListener('click', analyzeFamilyClick);
        document.getElementById('closeCompareModal').addEventListener('click', hideCompareModal);
        document.getElementById('doCompare').addEventListener('click', doCompare);
        document.getElementById('unknownTime').addEventListener('change', function () {
            document.getElementById('birthTime').disabled = this.checked;
            if (this.checked) document.getElementById('birthTime').value = '';
        });
        // 한자 검색 UI - 한글 발음으로 검색
        initHanjaSearch('hanjaSurname');
        initHanjaSearch('hanjaGiven1');
        initHanjaSearch('hanjaGiven2');
    }

    function showPersonForm() {
        document.getElementById('formSection').classList.remove('hidden');
        document.getElementById('personForm').reset();
        document.getElementById('birthTime').disabled = false;
        document.getElementById('formSection').scrollIntoView({ behavior: 'smooth' });
    }

    function hidePersonForm() {
        document.getElementById('formSection').classList.add('hidden');
    }

    function handleFormSubmit(e) {
        e.preventDefault();
        const name = document.getElementById('personName').value.trim();
        const birthDate = document.getElementById('birthDate').value;
        const birthTime = document.getElementById('birthTime').value;
        const unknownTime = document.getElementById('unknownTime').checked;
        const gender = document.getElementById('gender').value;
        const birthPlace = document.getElementById('birthPlace').value.trim();
        if (!name || !birthDate || !gender) { alert('이름, 생년월일, 성별은 필수입니다.'); return; }
        const [year, month, day] = birthDate.split('-').map(Number);
        let hour = 12, minute = 0;
        if (!unknownTime && birthTime) [hour, minute] = birthTime.split(':').map(Number);
        const hanjaSurname = document.getElementById('hanjaSurnameVal').value.trim();
        const hanjaGiven1 = document.getElementById('hanjaGiven1Val').value.trim();
        const hanjaGiven2 = document.getElementById('hanjaGiven2Val').value.trim();
        const hanjaChars = (hanjaSurname && hanjaGiven1) ? {
            surname: [...hanjaSurname],
            given: [hanjaGiven1, hanjaGiven2].filter(v => v)
        } : null;
        const member = { id: Date.now(), name, year, month, day, hour, minute, gender, birthPlace, unknownTime };
        const reading = SajuEngine.generateFullReading({ year, month, day, hour, minute, gender, name, hanjaChars });
        members.push(member);
        readings[member.id] = reading;
        hidePersonForm();
        renderMemberCards();
        renderReading(member.id);
        updateActionButtons();
    }

    function renderMemberCards() {
        const container = document.getElementById('memberCards');
        container.innerHTML = '';
        members.forEach(m => {
            const r = readings[m.id];
            const p = r.pillars;
            const dp = `${SajuEngine.STEMS[p.day.stem]}${SajuEngine.BRANCHES[p.day.branch]}`;
            const card = document.createElement('div');
            card.className = 'member-card';
            card.innerHTML = `
                <div class="member-card-header">
                    <span class="member-name">${m.name}</span>
                    <button class="delete-member" onclick="App.deleteMember(${m.id})" title="삭제">&times;</button>
                </div>
                <div class="member-score-badge score-${r.totalScore >= 75 ? 'high' : r.totalScore >= 50 ? 'mid' : 'low'}">${r.totalScore}점</div>
                <div class="member-info">${m.year}.${m.month}.${m.day} ${m.unknownTime ? '(시간미상)' : `${String(m.hour).padStart(2,'0')}:${String(m.minute).padStart(2,'0')}`}</div>
                <div class="member-pillar">${m.gender === 'male' ? '남' : '여'} | 일주: ${dp}</div>
                <button class="view-btn" onclick="App.renderReading(${m.id})">사주 보기</button>
            `;
            container.appendChild(card);
        });
    }

    function deleteMember(id) {
        if (!confirm('정말 삭제하시겠습니까?')) return;
        members = members.filter(m => m.id !== id);
        delete readings[id];
        renderMemberCards();
        updateActionButtons();
        document.getElementById('readingResult').innerHTML = '';
        document.getElementById('compareResult').innerHTML = '';
    }

    function updateActionButtons() {
        document.getElementById('compareBtn').style.display = members.length >= 2 ? 'inline-flex' : 'none';
        document.getElementById('familyBtn').style.display = members.length >= 2 ? 'inline-flex' : 'none';
    }

    // 카테고리 점수 바
    function renderCategoryBar(label, score) {
        const cls = score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low';
        return `<div class="cat-bar-row">
            <span class="cat-label">${label}</span>
            <div class="cat-bar-track"><div class="cat-bar-fill cat-${cls}" style="width:${score}%"></div></div>
            <span class="cat-score">${score}</span>
        </div>`;
    }

    function renderReading(id) {
        const reading = readings[id];
        if (!reading) return;
        const container = document.getElementById('readingResult');
        const p = reading.pillars;
        const E = SajuEngine;
        const cs = reading.categoryScores;
        const sg = reading.scoreGrade;

        // 오행 바
        const maxEl = Math.max(...Object.values(reading.elements), 1);
        const elementBars = Object.entries(reading.elements).map(([el, count]) => `
            <div class="element-bar-row">
                <span class="element-label" style="color:${E.ELEMENT_COLORS[el]}">${el}(${E.ELEMENT_NAMES[el]})</span>
                <div class="element-bar-track"><div class="element-bar-fill" style="width:${(count/maxEl)*100}%;background:${E.ELEMENT_COLORS[el]}"></div></div>
                <span class="element-count">${count}</span>
            </div>
        `).join('');

        // 오행 과부족
        let elementAdvice = '';
        Object.entries(reading.elements).forEach(([el, count]) => {
            if (count === 0) elementAdvice += `<div class="advice-item lack"><strong>${el}(${E.ELEMENT_NAMES[el]}) 부족:</strong> ${E.ELEMENT_LACK[el]}</div>`;
            else if (count >= 4) elementAdvice += `<div class="advice-item excess"><strong>${el}(${E.ELEMENT_NAMES[el]}) 과다:</strong> ${E.ELEMENT_EXCESS[el]}</div>`;
        });

        // 합/충
        let relationsHtml = reading.branchRelations.length > 0
            ? reading.branchRelations.map(r => `<span class="relation-tag ${r.positive ? 'positive' : 'negative'}">${r.detail}</span>`).join('')
            : '<span class="relation-tag neutral">특별한 합/충 없음</span>';

        // 대운
        const daeunRows = reading.daeun.interpretations.map(d => {
            const isCurrent = reading.currentDaeun && d.daeunStr === reading.currentDaeun.daeunStr;
            return `<div class="daeun-card ${isCurrent ? 'current' : ''}">
                <div class="daeun-header">
                    <span class="daeun-pillar">${d.daeunStr}</span>
                    <span class="daeun-age">${d.ageRange}</span>
                    ${isCurrent ? '<span class="current-badge">현재</span>' : ''}
                </div>
                <div class="daeun-elements">
                    <span class="element-tag" style="background:${E.ELEMENT_COLORS[d.element]}">${d.element}</span>
                    <span class="element-tag" style="background:${E.ELEMENT_COLORS[d.branchElement]}">${d.branchElement}</span>
                </div>
                <div class="daeun-text">${d.interpretation}</div>
            </div>`;
        }).join('');

        // 십신
        const tg = reading.tenGods;
        const tenGodsHtml = `<div class="tengod-grid">
            <div class="tengod-item"><span class="tengod-pos">년주</span><span class="tengod-val">${tg.year.stem} / ${tg.year.branch}</span></div>
            <div class="tengod-item"><span class="tengod-pos">월주</span><span class="tengod-val">${tg.month.stem} / ${tg.month.branch}</span></div>
            <div class="tengod-item"><span class="tengod-pos">시주</span><span class="tengod-val">${tg.hour.stem} / ${tg.hour.branch}</span></div>
        </div>`;

        const member = members.find(m => m.id === id);
        const traits = reading.dayMasterTraits;

        // 사주 팔자 테이블 (한 줄로 표시)
        function pillarCol(label, stemIdx, branchIdx, isDay) {
            return `<div class="pillar-col ${isDay ? 'day-pillar' : ''}">
                <div class="pillar-label">${label}</div>
                <div class="pillar-stem" style="color:${E.ELEMENT_COLORS[E.STEM_ELEMENTS[stemIdx]]}">${E.STEMS[stemIdx]}<sub>${E.STEMS_HANJA[stemIdx]}</sub></div>
                <div class="pillar-branch" style="color:${E.ELEMENT_COLORS[E.BRANCH_ELEMENTS[branchIdx]]}">${E.BRANCHES[branchIdx]}<sub>${E.BRANCHES_HANJA[branchIdx]}</sub></div>
                <div class="pillar-element">${E.STEM_ELEMENTS[stemIdx]}/${E.BRANCH_ELEMENTS[branchIdx]}</div>
            </div>`;
        }

        container.innerHTML = `
            <div class="reading-card">
                <h2 class="reading-title">${reading.name}님의 사주풀이</h2>
                <p class="reading-subtitle">${member.year}년 ${member.month}월 ${member.day}일 ${member.unknownTime ? '(시간미상)' : `${String(member.hour).padStart(2,'0')}시 ${String(member.minute).padStart(2,'0')}분`} | ${reading.gender === 'male' ? '남성' : '여성'} | 만 ${reading.age - 1}세</p>
                ${member.birthPlace ? `<p class="reading-subtitle">출생지: ${member.birthPlace}</p>` : ''}

                <!-- 종합 점수 -->
                <section class="reading-section score-section">
                    <div class="total-score-circle" style="--score-color:${sg.color}">
                        <svg viewBox="0 0 120 120">
                            <circle cx="60" cy="60" r="52" class="score-bg"/>
                            <circle cx="60" cy="60" r="52" class="score-fg" style="stroke:${sg.color};stroke-dasharray:${reading.totalScore * 3.267} 326.7"/>
                        </svg>
                        <div class="score-inner">
                            <div class="score-num">${reading.totalScore}</div>
                            <div class="score-unit">/ 100</div>
                        </div>
                    </div>
                    <div class="score-grade" style="color:${sg.color}">${sg.grade} (${sg.label})</div>
                    <p class="score-desc">${sg.desc}</p>
                </section>

                <!-- 카테고리별 점수 -->
                <section class="reading-section">
                    <h3>분야별 운세 점수</h3>
                    <div class="category-bars">
                        ${renderCategoryBar('성격', cs.personality)}
                        ${renderCategoryBar('학업', cs.study)}
                        ${renderCategoryBar('재물', cs.wealth)}
                        ${renderCategoryBar('직업/명예', cs.career)}
                        ${renderCategoryBar('건강', cs.health)}
                        ${renderCategoryBar('연애/결혼', cs.love)}
                        ${renderCategoryBar('인간관계', cs.relations)}
                    </div>
                </section>

                <!-- 사주팔자 -->
                <section class="reading-section">
                    <h3>사주팔자 (四柱八字)</h3>
                    <div class="pillars-table">
                        ${pillarCol('시주(時)', p.hour.stem, p.hour.branch, false)}
                        ${pillarCol('일주(日)', p.day.stem, p.day.branch, true)}
                        ${pillarCol('월주(月)', p.month.stem, p.month.branch, false)}
                        ${pillarCol('년주(年)', p.year.stem, p.year.branch, false)}
                    </div>
                    <div class="animal-sign">${E.BRANCHES_ANIMAL[p.year.branch]}띠 (${E.BRANCHES[p.year.branch]}${E.BRANCHES_HANJA[p.year.branch]})</div>
                </section>

                <!-- 성격 분석 -->
                <section class="reading-section">
                    <h3>성격 분석 - ${traits.title}</h3>
                    <div class="trait-box">
                        <div class="trait-item">${traits.personality}</div>
                        <div class="trait-item detail">${traits.personality_detail}</div>
                    </div>
                </section>

                <!-- 학업/시험운 -->
                <section class="reading-section">
                    <h3>학업 / 시험운</h3>
                    <div class="trait-box">
                        <div class="trait-item">${traits.study}</div>
                    </div>
                </section>

                <!-- 재물운 -->
                <section class="reading-section">
                    <h3>재물운</h3>
                    <div class="trait-box">
                        <div class="trait-item">${traits.wealth}</div>
                    </div>
                </section>

                <!-- 직업/적성 -->
                <section class="reading-section">
                    <h3>직업 / 적성</h3>
                    <div class="trait-box">
                        <div class="trait-item">${traits.career}</div>
                    </div>
                </section>

                <!-- 건강운 -->
                <section class="reading-section">
                    <h3>건강운</h3>
                    <div class="trait-box">
                        <div class="trait-item">${traits.health}</div>
                        <div class="trait-item detail">${traits.health_detail}</div>
                    </div>
                </section>

                <!-- 연애/결혼운 -->
                <section class="reading-section">
                    <h3>연애 / 결혼운</h3>
                    <div class="trait-box">
                        <div class="trait-item">${traits.love}</div>
                        <div class="trait-item detail">${traits.love_detail}</div>
                    </div>
                </section>

                <!-- 인간관계 -->
                <section class="reading-section">
                    <h3>인간관계</h3>
                    <div class="trait-box">
                        <div class="trait-item">${traits.relations}</div>
                    </div>
                </section>

                <!-- 행운 아이템 -->
                <section class="reading-section">
                    <h3>행운 정보</h3>
                    <div class="lucky-grid">
                        <div class="lucky-item"><span class="lucky-label">행운의 색</span><span class="lucky-val">${traits.lucky.color}</span></div>
                        <div class="lucky-item"><span class="lucky-label">행운의 방위</span><span class="lucky-val">${traits.lucky.direction}</span></div>
                        <div class="lucky-item"><span class="lucky-label">행운의 수</span><span class="lucky-val">${traits.lucky.number}</span></div>
                        <div class="lucky-item"><span class="lucky-label">행운의 계절</span><span class="lucky-val">${traits.lucky.season}</span></div>
                        <div class="lucky-item full"><span class="lucky-label">행운의 아이템</span><span class="lucky-val">${traits.lucky.item}</span></div>
                    </div>
                </section>

                <!-- 오행 분석 -->
                <section class="reading-section">
                    <h3>오행 분석</h3>
                    <div class="element-chart">${elementBars}</div>
                    <div class="yongsin-box">
                        <strong>용신(用神):</strong> ${reading.yongsin.yongsin}(${E.ELEMENT_NAMES[reading.yongsin.yongsin]})
                        <p>${reading.yongsin.reason} ${reading.yongsin.yongsin}(${E.ELEMENT_NAMES[reading.yongsin.yongsin]}) 기운이 필요합니다.</p>
                        <p><strong>일간 강약:</strong> ${reading.yongsin.dayStrength === 'strong' ? '신강(身強) - 일간의 힘이 강합니다' : '신약(身弱) - 일간의 힘이 약합니다'}</p>
                    </div>
                    ${elementAdvice ? `<div class="element-advice">${elementAdvice}</div>` : ''}
                </section>

                <!-- 십신 -->
                <section class="reading-section">
                    <h3>십신 분석</h3>
                    ${tenGodsHtml}
                </section>

                <!-- 합/충 -->
                <section class="reading-section">
                    <h3>사주 내 합/충 관계</h3>
                    <div class="relations">${relationsHtml}</div>
                </section>

                <!-- 지장간 -->
                <section class="reading-section">
                    <h3>지장간 (地藏干) - 숨겨진 기운</h3>
                    <p class="section-desc">지지(地支) 속에 감춰진 천간으로, 겉으로 드러나지 않는 내면의 기운을 나타냅니다.</p>
                    <div class="jijanggan-grid">
                        ${['hour','day','month','year'].map(pos => {
                            const label = {year:'년주',month:'월주',day:'일주',hour:'시주'}[pos];
                            const jj = reading.jijanggan.positions[pos];
                            return `<div class="jijanggan-col">
                                <div class="jijanggan-label">${label}</div>
                                <div class="jijanggan-branch" style="color:${E.ELEMENT_COLORS[E.BRANCH_ELEMENTS[p[pos].branch]]}">${E.BRANCHES[p[pos].branch]}</div>
                                <div class="jijanggan-stems">
                                    ${jj.map((j, idx) => `<span class="jj-stem" style="color:${E.ELEMENT_COLORS[j.element]}" title="${['본기','중기','여기'][idx]}">${j.name}<sub>${j.hanja}</sub><small>${['본기','중기','여기'][idx]}</small></span>`).join('')}
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </section>

                <!-- 신살 -->
                ${reading.shinsal.length > 0 ? `
                <section class="reading-section">
                    <h3>신살 (神殺) - 특수한 기운</h3>
                    <div class="shinsal-grid">
                        ${reading.shinsal.map(s => `
                            <div class="shinsal-card shinsal-${s.type}">
                                <div class="shinsal-header">
                                    <span class="shinsal-name">${s.name}</span>
                                    <span class="shinsal-hanja">${s.hanja}</span>
                                    <span class="shinsal-type-badge shinsal-badge-${s.type}">${s.type === 'positive' ? '길신' : s.type === 'caution' ? '주의' : '중성'}</span>
                                </div>
                                <p class="shinsal-desc">${s.desc}</p>
                                <p class="shinsal-detail">${s.detail}</p>
                            </div>
                        `).join('')}
                    </div>
                </section>` : ''}

                <!-- 세운 (올해 운세) -->
                <section class="reading-section">
                    <h3>세운 (歲運) - ${reading.seun.year}년 올해 운세</h3>
                    <div class="seun-header-box">
                        <div class="seun-year-info">
                            <span class="seun-year-pillar">${reading.seun.seunStr}</span>
                            <span class="seun-animal">${reading.seun.animal}띠 해</span>
                        </div>
                        <div class="seun-score-box">
                            <div class="seun-luck-label">${reading.seun.overallLuck}</div>
                            <div class="seun-luck-bar"><div class="seun-luck-fill" style="width:${reading.seun.luckScore}%;background:${reading.seun.luckScore >= 60 ? '#2d8a4e' : reading.seun.luckScore >= 40 ? '#c8a951' : '#e63946'}"></div></div>
                            <div class="seun-luck-score">${reading.seun.luckScore}점</div>
                        </div>
                        <div class="seun-meta">
                            <span>십신: <strong>${reading.seun.tenGodType}</strong></span>
                            <span>세운오행: <strong style="color:${E.ELEMENT_COLORS[reading.seun.seunElement]}">${reading.seun.seunElement}</strong> / <strong style="color:${E.ELEMENT_COLORS[reading.seun.seunBrElement]}">${reading.seun.seunBrElement}</strong></span>
                            ${reading.seun.isYongsinYear ? '<span class="yongsin-year-badge">용신의 해!</span>' : ''}
                        </div>
                        ${reading.seun.seunRelations.length > 0 ? `<div class="seun-relations">${reading.seun.seunRelations.map(r => `<span class="relation-tag ${r.type === 'hap' ? 'positive' : 'negative'}">${r.detail}</span>`).join('')}</div>` : ''}
                    </div>
                    <div class="seun-interp">
                        <div class="seun-interp-item"><strong>총운:</strong> ${reading.seun.interpretations.overall}</div>
                        <div class="seun-interp-item"><strong>재물운:</strong> ${reading.seun.interpretations.wealth}</div>
                        <div class="seun-interp-item"><strong>직업운:</strong> ${reading.seun.interpretations.career}</div>
                        <div class="seun-interp-item"><strong>연애운:</strong> ${reading.seun.interpretations.love}</div>
                        <div class="seun-interp-item"><strong>건강운:</strong> ${reading.seun.interpretations.health}</div>
                    </div>
                </section>

                <!-- 대운 -->
                <section class="reading-section">
                    <h3>대운 (大運) - 10년 단위 운세</h3>
                    <p class="daeun-direction">${reading.daeun.forward ? '순행(順行)' : '역행(逆行)'} | 대운 시작: ${reading.daeun.startAge}세</p>
                    ${reading.currentDaeun ? `
                        <div class="current-daeun-highlight">
                            <strong>현재 대운 (${reading.currentDaeun.ageRange}):</strong> ${reading.currentDaeun.daeunStr}
                            <p>${reading.currentDaeun.interpretation}</p>
                        </div>
                    ` : ''}
                    <div class="daeun-grid">${daeunRows}</div>
                </section>

                <!-- 성명학 -->
                ${reading.nameAnalysis ? `
                <section class="reading-section">
                    <h3>성명학 (姓名學) - 이름 분석</h3>
                    <div class="name-score-box">
                        <span class="name-score-label">이름 점수</span>
                        <span class="name-score-num">${reading.nameAnalysis.nameScore}점</span>
                    </div>

                    <!-- 한자 뜻풀이 -->
                    <div class="char-analysis-section">
                        <h4>한자 뜻풀이</h4>
                        <div class="char-cards">
                            ${reading.nameAnalysis.charAnalysis.map((c, idx) => `
                                <div class="char-card">
                                    <div class="char-big" style="color:${E.ELEMENT_COLORS[c.element]}">${c.char}</div>
                                    <div class="char-reading">${c.reading}</div>
                                    <div class="char-strokes">${c.strokes}획</div>
                                    <div class="char-element"><span class="element-dot" style="background:${E.ELEMENT_COLORS[c.element]}"></span>${c.element}(${E.ELEMENT_NAMES[c.element]})</div>
                                    <div class="char-meaning">${c.meaning}</div>
                                    ${c.sajuHarmony ? `<div class="char-harmony char-harmony-${c.sajuHarmony.type}">${c.sajuHarmony.msg}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <!-- 오격 수리 -->
                    <div class="gyeok-section">
                        <h4>오격 수리 분석</h4>
                        <div class="gyeok-grid">
                            ${reading.nameAnalysis.gyeoks.map(g => `
                                <div class="gyeok-card gyeok-${g.luck}">
                                    <div class="gyeok-header">
                                        <span class="gyeok-name">${g.name}<sub>${g.hanja}</sub></span>
                                        <span class="gyeok-value">${g.value}획</span>
                                    </div>
                                    <div class="gyeok-element" style="color:${E.ELEMENT_COLORS[g.element]}">${g.element}(${E.ELEMENT_NAMES[g.element]})</div>
                                    <div class="gyeok-luck">${g.luckLabel}</div>
                                    <div class="gyeok-desc">${g.desc}</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="name-relations">
                        <h4>오행 관계</h4>
                        ${reading.nameAnalysis.relations.map(r => `
                            <div class="name-rel-item ${r.rel === '상생' ? 'positive' : r.rel === '상극' ? 'negative' : 'neutral'}">
                                <strong>${r.pair}:</strong> ${r.rel} - ${r.desc}
                            </div>
                        `).join('')}
                    </div>

                    ${reading.nameAnalysis.sajuCompat ? `
                    <div class="saju-compat-box ${reading.nameAnalysis.sajuCompat.isGood ? 'good' : ''}">
                        <h4>사주-이름 궁합</h4>
                        <p>${reading.nameAnalysis.sajuCompat.message}</p>
                    </div>` : ''}
                </section>` : ''}
            </div>
        `;
        container.scrollIntoView({ behavior: 'smooth' });
    }

    // 궁합
    function showCompareModal() {
        const modal = document.getElementById('compareModal');
        const s1 = document.getElementById('comparePerson1'), s2 = document.getElementById('comparePerson2');
        s1.innerHTML = ''; s2.innerHTML = '';
        members.forEach(m => { s1.innerHTML += `<option value="${m.id}">${m.name}</option>`; s2.innerHTML += `<option value="${m.id}">${m.name}</option>`; });
        if (members.length >= 2) s2.selectedIndex = 1;
        modal.classList.remove('hidden');
    }
    function hideCompareModal() { document.getElementById('compareModal').classList.add('hidden'); }

    function doCompare() {
        const id1 = Number(document.getElementById('comparePerson1').value);
        const id2 = Number(document.getElementById('comparePerson2').value);
        if (id1 === id2) { alert('서로 다른 사람을 선택해주세요.'); return; }
        hideCompareModal();
        const p1 = { ...members.find(m => m.id === id1), pillars: readings[id1].pillars };
        const p2 = { ...members.find(m => m.id === id2), pillars: readings[id2].pillars };
        renderCompatibility(p1, p2, SajuEngine.analyzeCompatibility(p1, p2));
    }

    function renderCompatibility(p1, p2, result) {
        const container = document.getElementById('compareResult');
        const scoreClass = result.score >= 80 ? 'excellent' : result.score >= 60 ? 'good' : result.score >= 40 ? 'average' : 'poor';
        const scoreLabel = result.score >= 80 ? '천생연분' : result.score >= 60 ? '좋은 궁합' : result.score >= 40 ? '보통' : '노력 필요';
        const details = result.details.map(d => `<div class="compat-detail ${d.type}"><span class="compat-icon">${d.type==='excellent'?'◎':d.type==='good'?'○':d.type==='warning'?'△':d.type==='caution'?'▽':'─'}</span>${d.text}</div>`).join('');
        const advice = result.advice.map(a => `<div class="compat-advice">${a}</div>`).join('');
        container.innerHTML = `<div class="reading-card compat-card">
            <h2 class="reading-title">${p1.name} & ${p2.name} 궁합</h2>
            <div class="compat-score-section">
                <div class="compat-score ${scoreClass}"><div class="score-number">${result.score}</div><div class="score-label">${scoreLabel}</div></div>
                <div class="score-bar-track"><div class="score-bar-fill ${scoreClass}" style="width:${result.score}%"></div></div>
            </div>
            <div class="compat-details">${details}</div>
            <div class="compat-advices"><h3>조언</h3>${advice}</div>
        </div>`;
        container.scrollIntoView({ behavior: 'smooth' });
    }

    // 가족 기운
    function analyzeFamilyClick() {
        if (members.length < 2) { alert('최소 2명 필요합니다.'); return; }
        const data = members.map(m => ({ name: m.name, pillars: readings[m.id].pillars }));
        renderFamilyEnergy(SajuEngine.analyzeFamilyEnergy(data));
    }

    function renderFamilyEnergy(result) {
        const container = document.getElementById('compareResult');
        const E = SajuEngine;
        const maxEl = Math.max(...Object.values(result.totalElements), 1);
        const bars = Object.entries(result.totalElements).map(([el, count]) => `
            <div class="element-bar-row">
                <span class="element-label" style="color:${E.ELEMENT_COLORS[el]}">${el}(${E.ELEMENT_NAMES[el]})</span>
                <div class="element-bar-track"><div class="element-bar-fill" style="width:${(count/maxEl)*100}%;background:${E.ELEMENT_COLORS[el]}"></div></div>
                <span class="element-count">${count}</span>
            </div>`).join('');
        const memberCharts = result.memberAnalyses.map(ma => {
            const mMax = Math.max(...Object.values(ma.elements), 1);
            const b = Object.entries(ma.elements).map(([el,c]) => `<span class="mini-bar" style="background:${E.ELEMENT_COLORS[el]};width:${(c/mMax)*50}px" title="${el}: ${c}"></span>`).join('');
            return `<div class="family-member-row"><strong>${ma.name}:</strong> ${b}</div>`;
        }).join('');
        const recs = result.recommendations.map(r => {
            if (r.type==='lacking') return `<div class="family-rec lacking"><h4>${r.message}</h4><ul><li><strong>방위:</strong> ${r.direction}</li><li><strong>색상:</strong> ${r.color}</li><li><strong>추천:</strong> ${r.items}</li><li><strong>행운의 수:</strong> ${r.numbers}</li></ul></div>`;
            return `<div class="family-rec excess"><h4>${r.message}</h4></div>`;
        }).join('');
        container.innerHTML = `<div class="reading-card family-card">
            <h2 class="reading-title">가족 기운 분석</h2>
            <section class="reading-section"><h3>가족 전체 오행 분포</h3><div class="element-chart">${bars}</div></section>
            <section class="reading-section"><h3>구성원별 오행</h3><div class="family-members-chart">${memberCharts}</div></section>
            ${result.recommendations.length > 0
                ? `<section class="reading-section"><h3>집안에 필요한 기운 & 보완 방법</h3>${recs}</section>`
                : `<section class="reading-section"><h3>집안 기운 분석</h3><p>가족 전체적으로 오행이 비교적 균형 잡혀 있습니다!</p></section>`}
        </div>`;
        container.scrollIntoView({ behavior: 'smooth' });
    }

    // 한자 검색 - 한글 발음(음)으로 한자 후보를 보여주고 터치로 선택
    function buildEumIndex() {
        const dict = SajuEngine.HANJA_DICT;
        const index = {};
        for (const [char, info] of Object.entries(dict)) {
            const eum = info[1]; // 음(읽기)
            if (!index[eum]) index[eum] = [];
            index[eum].push({ char, hun: info[0], eum: info[1], strokes: info[2], element: info[3], meaning: info[4] });
        }
        return index;
    }
    const eumIndex = buildEumIndex();

    function initHanjaSearch(inputId) {
        const input = document.getElementById(inputId);
        const dropId = inputId + 'Drop';
        const valId = inputId + 'Val';
        const selId = inputId + 'Selected';
        const drop = document.getElementById(dropId);
        const valInput = document.getElementById(valId);
        const selDiv = document.getElementById(selId);

        input.addEventListener('input', function () {
            const q = this.value.trim();
            if (!q) { drop.classList.remove('open'); drop.innerHTML = ''; return; }
            // 한글 자모만 있으면 무시 (조합 중)
            if (/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(q)) return;
            const results = eumIndex[q] || [];
            if (results.length === 0) {
                drop.innerHTML = '<div class="hanja-no-result">일치하는 한자가 없습니다</div>';
                drop.classList.add('open');
                return;
            }
            drop.innerHTML = results.map(r =>
                `<div class="hanja-option" data-char="${r.char}" data-hun="${r.hun}" data-eum="${r.eum}" data-el="${r.element}" data-strokes="${r.strokes}">
                    <span class="hanja-option-char" style="color:${SajuEngine.ELEMENT_COLORS[r.element]}">${r.char}</span>
                    <span class="hanja-option-info">${r.hun} ${r.eum} <small>(${r.strokes}획, ${r.element})</small></span>
                </div>`
            ).join('');
            drop.classList.add('open');
        });

        input.addEventListener('focus', function () {
            if (this.value.trim() && drop.innerHTML) drop.classList.add('open');
        });

        drop.addEventListener('click', function (e) {
            const opt = e.target.closest('.hanja-option');
            if (!opt) return;
            const char = opt.dataset.char;
            const hun = opt.dataset.hun;
            const eum = opt.dataset.eum;
            const el = opt.dataset.el;
            const strokes = opt.dataset.strokes;
            valInput.value = char;
            input.value = '';
            drop.classList.remove('open');
            drop.innerHTML = '';
            selDiv.innerHTML = `<span class="hanja-selected-tag">
                <span class="sel-char" style="color:${SajuEngine.ELEMENT_COLORS[el]}">${char}</span>
                <span class="sel-reading">${hun} ${eum} (${strokes}획)</span>
                <button type="button" class="sel-remove" title="삭제">&times;</button>
            </span>`;
            selDiv.querySelector('.sel-remove').addEventListener('click', function () {
                valInput.value = '';
                selDiv.innerHTML = '';
            });
        });

        // 바깥 터치하면 드롭다운 닫기
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.hanja-input-item')) {
                document.querySelectorAll('.hanja-dropdown').forEach(d => d.classList.remove('open'));
            }
        });
    }

    return { init, renderReading, deleteMember, showCompareModal, hideCompareModal, doCompare, analyzeFamilyClick };
})();

document.addEventListener('DOMContentLoaded', App.init);
