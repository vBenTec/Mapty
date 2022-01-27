'strict';

// const { number } = require('assert-plus');

class Workout {
  // date = new Date();
  // id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(
    coords,
    distance,
    duration,
    date = new Date(),
    id = (Date.now() + '').slice(-10)
  ) {
    // this.date = ...
    // this.id = ....
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this.date = date;
    this.id = id;
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}
    `;
  }

  click() {
    this.clicks++;
  }

  async _reverseGeoCode(coordsArr) {
    try {
      const [lat, lng] = coordsArr;
      console.log(lat, lng);
      const resData = await fetch(
        `https://geocode.xyz/${lat},${lng}?geoit=json&auth=210295472141395188486x78251`
      );
      if (!resData.ok) throw new Error('😟 Could not get location details');

      const geoData = await resData.json();

      this.city = geoData.city;
      this.country = geoData.country;
      console.log(geoData.city, geoData.country);
    } catch (err) {
      console.error(err);
    }
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence, date, id) {
    super(coords, distance, duration, date, id);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain, date, id) {
    super(coords, distance, duration, date, id);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
    // this._reverseGeoCode(coords);
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);
// console.log(run1, cycling1);

///////////////////////////
// Application Architecture

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAllWorkoutBtn = document.querySelector('.btn-reset');
const overlayError = document.querySelector('.modal-error__overlay');
const btnError = document.querySelector('.modal-error__btn');

class App {
  #map;
  #mapEvent;
  #workouts = [];
  #mapZoomLevel = 13;

  constructor() {
    // this.workouts = [];

    // Get users position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    // containerWorkouts.addEventListener(
    //   'click',
    //   function () {
    //     this._moveToPopup();
    //     this._editWorkouts();
    //     this._deleteWorkout();
    //   }.bind(this)
    // );

    // containerWorkouts.addEventListener('click', this._editWorkouts.bind(this));
    // containerWorkouts.onclick(this._editWorkouts.bind(this));

    containerWorkouts.addEventListener(
      'click',
      function (e) {
        console.log(this);
        console.log(e);
        if (!e) return;
        this._editWorkouts(e);
        this._deleteWorkout(e);
      }.bind(this)
    );

    // containerWorkouts.addEventListener('click', this._deleteWorkout.bind(this));

    deleteAllWorkoutBtn.addEventListener('click', this.reset);
    btnError.addEventListener('click', this._deleteError);

    window.addEventListener('load', () => this._toggleRemoveAllBtn());
    window.addEventListener('keydown', this._closeForm.bind(this));
  }

  _getPosition() {
    // Testing if the gelocation does exist
    if (navigator.geolocation)
      // Get geolocation
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get the position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;
    console.log(latitude, longitude);
    console.log(`https://www.google.com/maps/@${latitude},${longitude}`);

    const coords = [latitude, longitude];

    console.log(this);
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    // console.log(map);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('click', this._showForm.bind(this));

    // Displaying the markers from the workout array
    this.#workouts.forEach(work => {
      this._renderWorkout(work);
      this._renderWorkoutMarker(work);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _toggleRemoveAllBtn() {
    if (this.#workouts.length === 0) {
      console.log('💥 Hide remove all btn');
      deleteAllWorkoutBtn.classList.add('btn-reset--hidden');
    } else {
      console.log('✅ Show remove all btn');
      console.log(this.#workouts);
      deleteAllWorkoutBtn.classList.remove('btn-reset--hidden');
    }
  }

  _hideForm() {
    // Empty Inputs
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _closeForm(e) {
    if (e.key === 'Escape') this._hideForm();
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));

    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();

    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

    // If workout is running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;

      // Check if data is valid
      if (
        // !Number.isFinite(distance) ||
        // !Number.isFinite(duration) ||
        // !Number.isFinite(cadence)
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return this._renderError();

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      // Check if data is valid
      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return this._renderError();

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Reverse Geocoding
    // this._reverseGeocode(workout);
    // console.log(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide form + clear input fields
    this._hideForm();

    // Show deleteAllBtn or not
    this._toggleRemoveAllBtn();

    // Listening for Edit changes
    const workoutContainer = document.querySelector('.workout');
    workoutContainer.addEventListener('click', this._editWorkouts.bind(this));

    // Set local storage to all workouts
    this._setLocalStorage();
  }

  // async _reverseGeocode(workout) {
  //   try {
  //     const [lat, lng] = workout.coords;
  //     console.log(lat, lng);
  //     const resData = await fetch(
  //       `https://geocode.xyz/${lat},${lng}?geoit=json`
  //     );
  //     if (!resData.ok) throw new Error('😟 Could not get location details');

  //     const geoData = await resData.json();

  //     workout.city = geoData.city;
  //     workout.country = geoData.country;
  //     console.log(geoData.city, geoData.country);
  //   } catch (err) {
  //     console.error(err);
  //   }
  // }

  _renderWorkoutMarker(workout) {
    // console.log(workout);
    // let workoutTest = workout;

    // console.log(workoutTest);
    workout._reverseGeoCode(workout.coords).then(() => {
      // const city = workout.city;
      // const country = workout.country;
      // console.log(city, country);

      L.marker(workout.coords)
        .addTo(this.#map)
        .bindPopup(
          L.popup({
            maxWidth: 250,
            minWidth: 100,
            autoClose: false,
            closeOnClick: false,
            className: `${workout.type}-popup`,
          })
        )

        .setPopupContent(
          `${workout.type === 'running' ? '🏃' : '🚴'} ${this._checkApiRequest(
            workout
          )}`
        )
        .openPopup();
    });
  }

  _checkApiRequest(workout) {
    // If the api reqeust was succesfull we render country and city
    // If not we render the default description
    console.log(workout);

    if (workout.type === 'running') {
      if (workout.city && workout.country) {
        return `Running in ${workout.city}, ${workout.country}`;
      } else return `${workout.description}`;
    }

    if (workout.type === 'cycling') {
      if (workout.city && workout.country) {
        return `Cycling in ${workout.city}, ${workout.country}`;
      } else return `${workout.description}`;
    }
  }

  _renderWorkout(workout) {
    console.log(workout);

    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <div class=workout__heading-container>
          <h2 class="workout__title">${this._checkApiRequest(workout)} 
          </h2>
          <div class="workout__icon-delete">
          <span class="trash">
              <span></span>
              <i></i>
            </span>
        </div>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♂️'
          }</span>
          <span class="workout__value" data-type="distance">${
            workout.distance
          }</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value" data-type="duration">${
            workout.duration
          }</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
          <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value workout__value--pace" data-type="pace">${workout.pace.toFixed(
            1
          )}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value" data-type="cadence">${
            workout.cadence
          }</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value workout__value--speed" data-type="speed">${workout.speed.toFixed(
            1
          )}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value" data-type="elevationGain">${
            workout.elevationGain
          }</span>
          <span class="workout__unit">m</span>
        </div>
      </li> 
    `;

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (workoutEl === null) return;
    // console.log(workoutEl);

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );
    // console.log(workout);

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });

    // Using the public interface
    workout.click();
  }

  _deleteWorkout(e) {
    const workoutEl = e.target.closest('.workout');
    const deleteIcon = e.target.closest('.workout__icon-delete');

    if (!deleteIcon || !workoutEl) return;

    // Delete workout from the DOM
    workoutEl.style.transform = 'translateX(2rem)';
    workoutEl.style.opacity = 0;

    setTimeout(() => workoutEl.remove(), 250);

    const updatedWorkouts = this.#workouts.filter(workout => {
      console.log(workout.id, workoutEl.dataset.id);
      return workout.id !== workoutEl.dataset.id;
    });

    this.#workouts = updatedWorkouts;

    console.log(updatedWorkouts);
    console.log(this.#workouts);
    console.log(workoutEl);
    console.log(deleteIcon);

    // Delete workout from Local Storage
    localStorage.removeItem('workouts');
    this._setLocalStorage();

    // Delete marker on map
    location.reload();
  }

  _removeAllWorkouts() {
    // Removing all workouts from the DOM
    const allWorkouts = document.querySelectorAll('.workout');
    console.log(allWorkouts);
    allWorkouts.forEach(workout => workout.remove());

    // Clearing local storage
    this.reset();
  }

  _editWorkouts(e) {
    console.log(e.target);

    // Check target because of page reload and invoking from submit event
    if (e.target.classList.contains('form__btn')) return;
    e.preventDefault();
    const currElParrent = e.target.closest('.workout');
    const valueEl = e.target.closest('.workout__value');

    const valueElDataSet = valueEl?.dataset?.type;

    let speedEl = document.querySelector('.workout__value--speed');
    let paceEl = document.querySelector('.workout__value--pace');
    console.log(currElParrent);

    if (!valueEl || !currElParrent) return;
    if (valueElDataSet === 'pace' || valueElDataSet === 'speed')
      return alert('You can not edit this number');

    const html = `
      <form class="form-edit">
        <label></label>
        <input type="text" class="form-edit__number" />
      </form>
    `;

    // Guard clause the opposite if it is true then return
    // Prevent inserting more html windows
    if (valueEl.firstElementChild) return;

    valueEl.insertAdjacentHTML('afterbegin', html);

    const formEdit = document.querySelector('.form-edit');
    const userInputField = document.querySelector('.form-edit__number');

    userInputField.focus();
    console.log(currElParrent);
    console.log(this.#workouts);

    // _updateWorkoutArr();
    console.log(valueEl);
    console.log(valueElDataSet);

    formEdit.addEventListener(
      'submit',
      function (e) {
        e.preventDefault();
        const userInputValue = userInputField.value;
        console.log(userInputValue);

        const currentElId = currElParrent.dataset.id;
        console.log(currentElId);

        // Updating workoutarry with
        // 1) id of parrent element.
        // 2) data type of input element.
        // 3) Value that should  be updated
        this._updateWorkoutArr(currentElId, valueElDataSet, userInputValue);

        // console.log(this.#workouts);
        formEdit.remove();

        if (userInputField.value === '') return;
        valueEl.textContent = userInputValue;

        console.log(speedEl);
        // Updating the UI for calculations
        if (speedEl !== null) {
          const speedElData = speedEl.dataset.type;
          this._updateCalcUi(currentElId, speedElData, speedEl);
        }

        console.log(paceEl);
        if (paceEl !== null) {
          const paceElData = paceEl.dataset.type;
          this._updateCalcUi(currentElId, paceElData, paceEl);
        }

        // Update local storage
        this._setLocalStorage();
      }.bind(this)
    );
  }

  _updateWorkoutArr(dataId, dataType, number) {
    this.#workouts.forEach(workout => {
      if (workout.id === dataId) {
        if (dataType === 'duration') workout.duration = +number;
        if (dataType === 'cadence') workout.cadence = +number;
        if (dataType === 'distance') workout.distance = +number;
        if (dataType === 'cadence') workout.cadence = +number;
        if (dataType === 'elevationgain') workout.elevationGain = +number;
      }
    });
  }

  _updateCalcUi(dataId, dataType, el) {
    console.log(dataType);
    console.log(el);
    this.#workouts.forEach(workout => {
      if (workout.id === dataId) {
        if (dataType === 'speed') {
          if (!workout.calcSpeed) return;
          workout.calcSpeed();
          el.textContent = workout.speed.toFixed(1);
        }
        if (dataType === 'pace') {
          if (!workout.calcPace) return;
          workout.calcPace();
          el.textContent = workout.pace.toFixed(1);
        }
      }
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    console.log(data);
    if (!data) return;

    // Restoring Object to running and cycling classes
    const restoredArr = data.map(workout => {
      if (workout.type === 'running') {
        return new Running(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.cadence,
          new Date(workout.date),
          workout.id
        );
      }
      if (workout.type === 'cycling') {
        return new Cycling(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.elevationGain,
          new Date(workout.date),
          workout.id
        );
      }
    });

    console.log(data);
    console.log(restoredArr);
    this.#workouts = restoredArr;
  }

  _renderError() {
    overlayError.classList.remove('modal-error__overlay--hidden');
  }

  _deleteError() {
    overlayError.classList.add('modal-error__overlay--hidden');
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
