/* =========================================================================
   AGE CALCULATOR — SCRIPT
   Vanilla JS (ES6+). No dependencies, no build step.
   Table of contents:
     1. DOM Element References
     2. Constants
     3. Date Utility Functions
     4. Validation
     5. Calculation Functions
     6. Display / DOM Update Functions
     7. Event Handlers
     8. App Initialization
   ========================================================================= */

/* =========================================================================
   1. DOM ELEMENT REFERENCES
   Cached once at module scope so every function reuses the same lookups
   instead of re-querying the DOM on every calculation.
   ========================================================================= */
const ageForm = document.getElementById('age-form');
const dobInput = document.getElementById('dob-input');
const dobHint = document.getElementById('dob-hint');

const resultYears = document.getElementById('result-years');
const resultMonths = document.getElementById('result-months');
const resultDays = document.getElementById('result-days');
const resultTotalMonths = document.getElementById('result-total-months');
const resultTotalWeeks = document.getElementById('result-total-weeks');
const resultTotalDays = document.getElementById('result-total-days');

const infoNextBirthday = document.getElementById('info-next-birthday');
const infoDaysRemaining = document.getElementById('info-days-remaining');
const infoZodiacSign = document.getElementById('info-zodiac-sign');
const infoDayOfBirth = document.getElementById('info-day-of-birth');

const resultsSection = document.getElementById('results-section');
const infoCard = document.getElementById('info-card');

/* =========================================================================
   2. CONSTANTS
   ========================================================================= */
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PLACEHOLDER = '--';

const WEEKDAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

// Each entry is the LAST month/day covered by a sign, listed in calendar
// order. Capricorn appears twice because its range (Dec 22 - Jan 19) wraps
// across the year boundary, so it has to be split into two pieces.
const ZODIAC_RANGES = [
    { sign: 'Capricorn', endMonth: 1, endDay: 19 },
    { sign: 'Aquarius', endMonth: 2, endDay: 18 },
    { sign: 'Pisces', endMonth: 3, endDay: 20 },
    { sign: 'Aries', endMonth: 4, endDay: 19 },
    { sign: 'Taurus', endMonth: 5, endDay: 20 },
    { sign: 'Gemini', endMonth: 6, endDay: 20 },
    { sign: 'Cancer', endMonth: 7, endDay: 22 },
    { sign: 'Leo', endMonth: 8, endDay: 22 },
    { sign: 'Virgo', endMonth: 9, endDay: 22 },
    { sign: 'Libra', endMonth: 10, endDay: 22 },
    { sign: 'Scorpio', endMonth: 11, endDay: 21 },
    { sign: 'Sagittarius', endMonth: 12, endDay: 21 },
    { sign: 'Capricorn', endMonth: 12, endDay: 31 },
];

/* =========================================================================
   3. DATE UTILITY FUNCTIONS
   ========================================================================= */

/**
 * Returns today's date with the time stripped to local midnight, so it can
 * be safely compared against other calendar dates (birth date, next
 * birthday) without hours/minutes/seconds throwing the comparison off.
 */
function getCurrentDate() {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
}

/**
 * Converts a native <input type="date"> value ("YYYY-MM-DD") into a local
 * Date object at midnight. Splitting the string manually avoids the classic
 * pitfall of `new Date("YYYY-MM-DD")`, which JavaScript parses as UTC
 * midnight and can silently shift the calendar day backward in timezones
 * behind UTC.
 */
function parseDateInput(value) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Reduces a Date to a UTC timestamp representing only its calendar date
 * (year/month/day at 00:00 UTC). Used exclusively for day-count subtraction
 * so Daylight Saving Time transitions never introduce an off-by-one error.
 */
function toUTCDateOnly(date) {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
}

/* =========================================================================
   4. VALIDATION
   ========================================================================= */

/**
 * Validates the raw date-of-birth input value. Returns an object describing
 * whether the input is usable and, if not, a user-facing error message.
 * Keeping validation separate from calculation means calculateAge() never
 * has to defend against bad input itself.
 */
function validateInput(rawValue) {
    if (!rawValue) {
        return { isValid: false, errorMessage: 'Please select your date of birth to continue.' };
    }

    const birthDate = parseDateInput(rawValue);

    if (Number.isNaN(birthDate.getTime())) {
        return { isValid: false, errorMessage: 'Please enter a valid date.' };
    }

    if (birthDate > getCurrentDate()) {
        return { isValid: false, errorMessage: 'Date of birth cannot be in the future.' };
    }

    return { isValid: true, errorMessage: '', birthDate };
}

/* =========================================================================
   5. CALCULATION FUNCTIONS
   ========================================================================= */

/**
 * Calculates a calendar-accurate age breakdown (years, months, days)
 * between a birth date and today. Borrowing from the previous month when
 * `days` goes negative automatically accounts for varying month lengths
 * and leap years, because `new Date(year, month, 0)` always returns the
 * correct last day of the prior month for that specific year.
 */
function calculateAge(birthDate, today) {
    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    if (days < 0) {
        months -= 1;
        const daysInPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
        days += daysInPreviousMonth;
    }

    if (months < 0) {
        years -= 1;
        months += 12;
    }

    return { years, months, days };
}

/**
 * Returns the total whole number of days lived, computed from UTC-only
 * timestamps so the result is immune to Daylight Saving Time shifts.
 */
function calculateTotalDays(birthDate, today) {
    return Math.round((toUTCDateOnly(today) - toUTCDateOnly(birthDate)) / MS_PER_DAY);
}

/** Converts a years/months age breakdown into a single total-months count. */
function calculateTotalMonths(years, months) {
    return years * 12 + months;
}

/** Converts a total day count into a whole number of total weeks. */
function calculateTotalWeeks(totalDays) {
    return Math.floor(totalDays / 7);
}

/**
 * Finds the next occurrence of the birth date on or after today, and how
 * many days remain until it. If the birthday already happened this year,
 * the anniversary rolls forward to next year. A birth date of February 29
 * is handled naturally by the Date constructor: in a non-leap year it
 * overflows to March 1, which is the most common real-world convention.
 */
function calculateNextBirthday(birthDate, today) {
    let nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());

    if (toUTCDateOnly(nextBirthday) < toUTCDateOnly(today)) {
        nextBirthday = new Date(today.getFullYear() + 1, birthDate.getMonth(), birthDate.getDate());
    }

    const daysRemaining = Math.round((toUTCDateOnly(nextBirthday) - toUTCDateOnly(today)) / MS_PER_DAY);

    return { nextBirthday, daysRemaining };
}

/** Returns the full weekday name (e.g., "Monday") that a date fell on. */
function getBirthDayName(birthDate) {
    return WEEKDAY_NAMES[birthDate.getDay()];
}

/**
 * Determines the Western zodiac sign for a given month (1-12) and day.
 * Ranges are checked in calendar order; a date belongs to a sign either
 * when it falls within that sign's month at or before its cutoff day, or
 * when it falls in any earlier month than the cutoff (meaning it must have
 * matched a smaller/earlier range already, or is a later month than the
 * previous cutoff but still before this one).
 */
function calculateZodiacSign(month, day) {
    const match = ZODIAC_RANGES.find(
        ({ endMonth, endDay }) => month < endMonth || (month === endMonth && day <= endDay)
    );
    return match.sign;
}

/** Formats a Date as a long, human-readable string (e.g., "August 15, 2026"). */
function formatDateLong(date) {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

/* =========================================================================
   6. DISPLAY / DOM UPDATE FUNCTIONS
   ========================================================================= */

/**
 * Removes and re-adds an element's own class to restart its CSS animation.
 * The class already carries a fade/slide keyframe animation in style.css;
 * forcing a reflow between removal and re-addition is what allows the
 * animation to replay every time results are recalculated, using nothing
 * but class manipulation (no inline styles, no new CSS).
 */
function restartAnimation(element, animatedClassName) {
    element.classList.remove(animatedClassName);
    // Reading offsetWidth forces the browser to reflow before the class is
    // re-added, otherwise it would just see "class never changed".
    void element.offsetWidth;
    element.classList.add(animatedClassName);
}

/**
 * Writes every computed value into the results and information cards, then
 * replays their entrance animations. Centralizing all result writes here
 * means the calculation functions stay pure and DOM-free.
 */
function displayResults({ age, totalMonths, totalWeeks, totalDays, nextBirthday, daysRemaining, dayName, zodiacSign }) {
    resultYears.textContent = age.years;
    resultMonths.textContent = age.months;
    resultDays.textContent = age.days;
    resultTotalMonths.textContent = totalMonths;
    resultTotalWeeks.textContent = totalWeeks;
    resultTotalDays.textContent = totalDays;

    infoNextBirthday.textContent = formatDateLong(nextBirthday);
    infoDaysRemaining.textContent = daysRemaining === 0
        ? 'Today!'
        : `${daysRemaining} day${daysRemaining === 1 ? '' : 's'}`;
    infoZodiacSign.textContent = zodiacSign;
    infoDayOfBirth.textContent = dayName;

    restartAnimation(resultsSection, 'results-section');
    restartAnimation(infoCard, 'info-card');
}

/**
 * Puts every result placeholder back to its initial "--" state. Used both
 * before showing an error and when the form is reset, so results never
 * display stale data alongside a new error or an empty input.
 */
function clearResults() {
    [
        resultYears, resultMonths, resultDays,
        resultTotalMonths, resultTotalWeeks, resultTotalDays,
        infoNextBirthday, infoDaysRemaining, infoZodiacSign, infoDayOfBirth,
    ].forEach((element) => {
        element.textContent = PLACEHOLDER;
    });
}

/**
 * Displays a validation error using the existing date-of-birth hint text,
 * marks the input as invalid for assistive technology, and clears any
 * stale results so they don't sit next to an error message.
 */
function showError(message) {
    dobHint.textContent = message;
    dobHint.style.color = '#dc2626';
    dobInput.setAttribute('aria-invalid', 'true');
    dobInput.style.borderColor = '#dc2626';
    clearResults();
}

/**
 * Restores the date-of-birth hint to its original wording and clears the
 * invalid state from the input. Called whenever the user provides valid
 * input or resets the form.
 */
function clearError() {
    dobHint.textContent = 'Select your birth date using the date picker.';
    dobHint.style.color = '';
    dobInput.removeAttribute('aria-invalid');
    dobInput.style.borderColor = '';
}

/* =========================================================================
   7. EVENT HANDLERS
   ========================================================================= */

/**
 * Runs the full calculate flow: validate, compute, then either show an
 * error or display results. Bound to the form's `submit` event, which
 * covers both a click on "Calculate Age" and pressing Enter inside the
 * date field, since both trigger native form submission.
 */
function handleCalculateSubmit(event) {
    event.preventDefault();

    const { isValid, errorMessage, birthDate } = validateInput(dobInput.value);

    if (!isValid) {
        showError(errorMessage);
        return;
    }

    clearError();

    const today = getCurrentDate();
    const age = calculateAge(birthDate, today);
    const totalDays = calculateTotalDays(birthDate, today);
    const totalMonths = calculateTotalMonths(age.years, age.months);
    const totalWeeks = calculateTotalWeeks(totalDays);
    const { nextBirthday, daysRemaining } = calculateNextBirthday(birthDate, today);
    const dayName = getBirthDayName(birthDate);
    const zodiacSign = calculateZodiacSign(birthDate.getMonth() + 1, birthDate.getDate());

    displayResults({ age, totalMonths, totalWeeks, totalDays, nextBirthday, daysRemaining, dayName, zodiacSign });
}

/**
 * Restores the calculator to its initial state. Bound to the form's
 * `reset` event, which already fires when the "Reset" button is clicked
 * (its type="reset" triggers the browser's native form reset first).
 */
function resetCalculator() {
    clearResults();
    clearError();
    dobInput.focus();
}

/* =========================================================================
   8. APP INITIALIZATION
   ========================================================================= */

/**
 * Wires up all event listeners. Kept as a single entry point so the rest
 * of the file stays declarative: every other function is pure or only
 * touches the DOM when explicitly called.
 */
function initializeApp() {
    ageForm.addEventListener('submit', handleCalculateSubmit);
    ageForm.addEventListener('reset', resetCalculator);
}

document.addEventListener('DOMContentLoaded', initializeApp);
