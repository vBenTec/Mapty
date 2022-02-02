'strict';
import { config } from './config.js';
// const { number } = require('assert-plus');

class Workout {
  // date = new Date();
  // id = (Date.now() + '').slice(-10);
  clicks = 0;
  #keyGeo = config.apiKeyGeo;
  #keyWeather = config.apiKeyWeather;
  // _weather = {};

  constructor(
    coords,
    distance,
    duration,
    date = new Date(),
    id = (Date.now() + '').slice(-10),
    _weather = {}
  ) {
    // this.date = ...
    // this.id = ....
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
    this._date = date; // Only relevant for application logic
    this._id = id; // Only relevant for application logic
    this._weather = _weather; // Only relevant for application logic
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `
     ${this.type[0].toUpperCase()}${this.type.slice(
      1
    )} on ${this._date.getDate()} ${
      months[this._date.getMonth()]
    } , ${this._date.getFullYear()}
    `;
  }

  click() {
    this.clicks++;
  }

  // Set weather data from weather api
  _setWeatherData(clouds, temp, humidity, windSpeed, weatherArray) {
    // clouds %
    this._weather.clouds = clouds;

    // weather icon url
    this._weather.iconUrl = this._getWeatherIconUrl(weatherArray);

    // wind m/s
    this._weather.windSpeed = windSpeed;

    // humidity %
    this._weather.humidity = humidity;

    // temperatur kelvin
    this._weather.temp = this._convertCelsius(temp);
  }

  // Pass in an array with an object inside
  _getWeatherIconUrl(weather) {
    // Destructer array
    const [weatherObj] = weather;
    // Getting weather code for icon
    const iconCode = weatherObj.icon;
    // Getting URL
    const iconSrc = `http://openweathermap.org/img/wn/${iconCode}@2x.png`;
    return iconSrc;
  }

  // Passing in a number measured in kelvin and retrieve celsius
  _convertCelsius(kelvin) {
    const celsius = Math.round(Number(kelvin) - 273.15);
    return celsius;
  }

  // Pass in array of coords to retrieve data about coresponding city and country
  async _reverseGeoCode(coordsArr) {
    try {
      const [lat, lng] = coordsArr;
      const resData = await fetch(
        `https://geocode.xyz/${lat},${lng}?geoit=json`
        // `https://geocode.xyz/${lat},${lng}?geoit=json&auth=${this.#keyGeo}`
      );
      if (!resData.ok) throw new Error('😟 Could not get location details');

      const geoData = await resData.json();

      this.city = geoData.city;
      this.country = geoData.country;
    } catch (err) {
      console.error(err);
    }
  }

  // AJAX call to fetach data about the weather pass in coordinates
  async _getWeatherData(lat, lng) {
    try {
      const getRequest = await fetch(
        `https://api.openweathermap.org/data/2.5/onecall?lat=${lat}&lon=${lng}&appid=${
          this.#keyWeather
        }`
      );
      if (!getRequest.ok)
        throw new Error('😟 Something went wrong with the get request');

      const dataWeather = await getRequest.json();

      this._setWeatherData(
        dataWeather.current.clouds,
        dataWeather.current.temp,
        dataWeather.current.humidity,
        dataWeather.current.wind_speed,
        dataWeather.current.weather
      );
    } catch (err) {
      console.error(err);
    }
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence, _date, _id, _weather) {
    super(coords, distance, duration, _date, _id, _weather);
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
  constructor(coords, distance, duration, elevationGain, _date, _id, _weather) {
    super(coords, distance, duration, _date, _id, _weather);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

// DUMMY DATA
// const run1 = new Running([39, -12], 5.2, 24, 178);
// const cycling1 = new Cycling([39, -12], 27, 95, 523);

///////////////////////////
// Application Architecture

const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const btnsMenu = document.querySelector('.btns-menu');
const deleteAllWorkoutBtn = document.querySelector('.btn-reset');
const overlayError = document.querySelector('.modal-error__overlay');
const btnError = document.querySelector('.modal-error__btn');
const btnOverview = document.querySelector('.btn-overview');
const btnSort = document.querySelector('.btn-sort');
const sortBar = document.querySelector('.sort-bar');

class App {
  #map;
  #mapEvent;
  #workouts = [];
  #mapZoomLevel = 13;
  #markers = [];

  constructor() {
    // this.workouts = [];

    // Get users position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);

    // For the sort button functionality
    btnSort.addEventListener('click', this._toggleSortBtn);
    sortBar.addEventListener('click', this._sortAndRender.bind(this));

    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    // For the edit functionality
    containerWorkouts.addEventListener(
      'click',
      function (e) {
        if (!e) return;
        this._editWorkouts(e);
        this._deleteWorkout(e);
      }.bind(this)
    );

    // For the overview button functionality
    btnOverview.addEventListener('click', this._showOverview.bind(this));

    // For the delete all button functionality
    deleteAllWorkoutBtn.addEventListener('click', this.reset);
    btnError.addEventListener('click', this._deleteError);

    // For the close window functionality for the forms
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

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

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

  _toggleRemoveAllBtn() {
    // If workouts array is empty add hidden class
    if (this.#workouts.length === 0) {
      btnsMenu.classList.add('btns-menu--hidden');
      // If workouts array has entries remove hidden class
    } else {
      btnsMenu.classList.remove('btns-menu--hidden');
    }
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  // Function for user input validation
  _validInputs(...inputs) {
    return inputs.every(inp => Number.isFinite(inp));
  }

  // Function for user input validation
  _allPositive(...inputs) {
    return inputs.every(inp => inp > 0);
  }

  _newWorkout(e) {
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
        !this._validInputs(distance, duration, cadence) ||
        !this._allPositive(distance, duration, cadence)
      )
        return this._renderError();

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout is cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      // Check if data is valid
      if (
        !this._validInputs(distance, duration, elevation) ||
        !this._allPositive(distance, duration)
      )
        return this._renderError();

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    this._initWorkoutFunctions(workout, lat, lng);
  }

  async _initWorkoutFunctions(workout, lat, lng) {
    // AJAX call to get weather data to the workout
    await this._setWeatherData(workout, lat, lng);

    // Add new object to workout array
    this.#workouts.push(workout);

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

  async _setWeatherData(workout, lat, lng) {
    try {
      const test = await workout._getWeatherData(lat, lng);
      return test;
    } catch (err) {
      console.error(err);
    }
  }

  _renderWorkoutMarker(workout) {
    workout._reverseGeoCode(workout.coords).then(() => {
      // Brand icon
      const maptyIcon = L.icon({
        iconUrl: './assets/icon.png',
        iconSize: [50, 55],
        iconAnchor: [24, 3],
      });

      // Create a marker
      const layer = L.marker(workout.coords, { icon: maptyIcon })
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
          `${
            workout.type === 'running' ? '🏃' : '🚴'
          } ${this._checkGeoApiRequest(workout)}`
        )
        .openPopup();

      // push the marker inside of markers array
      this.#markers.push(layer);
    });
  }

  _renderWorkout(workout) {
    let html = '';

    // Check if some weather data exist
    if (workout._weather.clouds && workout._weather.humidity)
      html += `
      <li class="workout workout--${workout.type}" data-id="${workout._id}">
        <div class=workout__heading-container>
          <h2 class="workout__title">${this._checkGeoApiRequest(workout)} 
          </h2>
          <div class="workout__icon-delete">
          <span class="trash">
              <span></span>
              <i></i>
            </span>
        </div>
        </div>

        <div class="workout__weather">
          <span class="weather__value">🌡 ${workout._weather.temp}</span>
          <span class="weather__unit">°C</span>
          
        </div>

        <div class="workout__weather workout__weather--icon-container">
        <img src="${
          workout._weather.iconUrl
        }" alt="weather-status-icon" class="weather__icon ${
        this._checkWeatherIconBk(workout._weather.iconUrl)
          ? 'weather__icon--bk-change'
          : ''
      }" />  
        <span class="weather__value">${workout._weather.clouds}</span>
        <span class="weather__unit">%</span>
        </div>

        <div class="workout__weather">
          <span class="weather__value">💨 ${workout._weather.windSpeed}</span>
          <span class="weather__unit">m/s</span>
        </div>

        <div class="workout__weather">
          <span class="weather__value">💦  ${workout._weather.humidity}</span>
          <span class="weather__unit">%</span>
        </div>
      `;

    html += `
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
          <span class="workout__value workout__value--pace" id="value-pace" data-type="pace">${workout.pace.toFixed(
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
          <span class="workout__value workout__value--speed" id="value-speed" data-type="speed">${workout.speed.toFixed(
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

  _checkGeoApiRequest(workout) {
    // If the api reqeust was succesfull render country and city
    // If not render the default description

    // Check for the workout types to get right description
    if (workout.type === 'running') {
      if (workout.city && workout.country) {
        return `Running in ${workout.city}, ${workout.country}`;
      } else return `${workout.description}`;
    }

    // Check for the workout types to get right description
    if (workout.type === 'cycling') {
      if (workout.city && workout.country) {
        return `Cycling in ${workout.city}, ${workout.country}`;
      } else return `${workout.description}`;
    }
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (workoutEl === null) return;
    const workout = this.#workouts.find(
      work => work._id === workoutEl.dataset.id
    );

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

    // Get the index in the workout array for the markers array
    let index;
    const updatedWorkouts = this.#workouts.filter((workout, i) => {
      index = i;
      return workout._id !== workoutEl.dataset.id;
    });

    this.#workouts = updatedWorkouts;

    // Delete workout from Local Storage
    localStorage.removeItem('workouts');
    this._setLocalStorage();

    // Delete marker on map
    this.#markers[index].remove();

    // Remove marker from array
    this.#markers.splice(index);
    // location.reload();
  }

  _removeAllWorkouts() {
    // Removing all workouts from the DOM
    const allWorkouts = document.querySelectorAll('.workout');
    allWorkouts.forEach(workout => workout.remove());

    // Clearing local storage
    this.reset();
  }

  _editWorkouts(e) {
    // Check target because of page reload and invoking from submit event
    if (e.target.classList.contains('form__btn')) return;
    e.preventDefault();
    const currElParrent = e.target.closest('.workout');
    const valueEl = e.target.closest('.workout__value');

    const valueElDataSet = valueEl?.dataset?.type;

    // One of the element will always be null
    // currElParrent points always to the current element
    const speedEl = currElParrent?.querySelector('#value-pace');
    const paceEl = currElParrent?.querySelector('#value-speed');

    // Guard clause to prevent null
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

    //  Adding an event listener as soon as the user input form appears on the page
    formEdit.addEventListener(
      'submit',
      function (e) {
        e.preventDefault();
        const userInputValue = userInputField.value;

        const currentElId = currElParrent.dataset.id;

        if (
          !this._validInputs(+userInputValue) ||
          !this._allPositive(+userInputValue)
        )
          return this._renderError();

        // Updating workoutarry with
        // 1) id of parrent element.
        // 2) data type of input element.
        // 3) Value that should  be updated
        this._updateWorkoutArr(currentElId, valueElDataSet, userInputValue);

        formEdit.remove();

        if (userInputField.value === '') return;
        valueEl.textContent = userInputValue;

        // Updating the UI for calculations
        if (speedEl !== null) {
          const speedElData = speedEl.dataset.type;
          this._updateCalcUi(currentElId, speedElData, speedEl);
        }

        if (paceEl !== null) {
          const paceElData = paceEl.dataset.type;
          this._updateCalcUi(currentElId, paceElData, paceEl);
        }

        // Update local storage
        this._setLocalStorage();
      }.bind(this)
    );
  }

  _sortAndRender(e) {
    const el = e.target.closest('.sort-bar__btn-radio');
    let currentDirection = 'descending'; //default
    if (!el) return;

    const type = el.id;

    // get which direction to sort
    const typeValues = this.#workouts.map(workout => {
      return workout[type];
    });

    const sortedAscending = typeValues
      .slice()
      .sort(function (a, b) {
        return a - b;
      })
      .join('');

    const sortedDescending = typeValues
      .slice()
      .sort(function (a, b) {
        return b - a;
      })
      .join('');

    // Ascending order
    if (typeValues.join('') === sortedAscending) {
      currentDirection = 'ascending';
    }
    // Descending order
    if (typeValues.join('') === sortedDescending) {
      currentDirection = 'descending';
    }

    // sort workouts array
    this._sortArray(this.#workouts, currentDirection, type);

    // Render all workouts again

    // clear current rendered workouts from DOM
    containerWorkouts
      .querySelectorAll('.workout')
      .forEach(workout => workout.remove());

    // clear workouts from map
    this.#markers.forEach(marker => marker.remove());

    //clear array
    this.#markers = [];

    // render workout list again sorted
    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
      // create new markers and render them on map
      this._renderWorkoutMarker(workout);
    });
  }

  _toggleSortBtn() {
    sortBar.classList.toggle('sort-bar--hidden');
  }

  _sortArray(array, currentDirection, type) {
    // sort opposite to the currentDirection
    if (currentDirection === 'ascending') {
      array.sort((a, b) => b[type] - a[type]);
    }
    if (currentDirection === 'descending') {
      array.sort((a, b) => a[type] - b[type]);
    }
  }

  _showDeleteMsg() {
    confMsg.classList.remove('msg__hidden');
  }

  _updateWorkoutArr(dataId, dataType, number) {
    this.#workouts.forEach(workout => {
      if (workout._id === dataId) {
        if (dataType === 'duration') workout.duration = +number;
        if (dataType === 'cadence') workout.cadence = +number;
        if (dataType === 'distance') workout.distance = +number;
        if (dataType === 'cadence') workout.cadence = +number;
        if (dataType === 'elevationgain') workout.elevationGain = +number;
      }
    });
  }

  _updateCalcUi(dataId, dataType, el) {
    this.#workouts.forEach(workout => {
      if (workout._id === dataId) {
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

  // Check if the icon of the api contains an icon with same color as background
  _checkWeatherIconBk(stringUrl) {
    return stringUrl === 'http://openweathermap.org/img/wn/50d@2x.png'
      ? true
      : false;
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    // Restoring Object to running and cycling classes
    const restoredArr = data.map(workout => {
      if (workout.type === 'running') {
        return new Running(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.cadence,
          new Date(workout._date),
          workout._id,
          workout._weather
        );
      }
      if (workout.type === 'cycling') {
        return new Cycling(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.elevationGain,
          new Date(workout._date),
          workout._id,
          workout._weather
        );
      }
    });

    this.#workouts = restoredArr;
  }

  _renderError() {
    overlayError.classList.remove('modal-error__overlay--hidden');
  }

  _deleteError() {
    overlayError.classList.add('modal-error__overlay--hidden');
  }

  _showOverview() {
    // if there are no workouts return
    if (this.#workouts.length === 0) return;

    // look for lowest and highest lat and long to make map bounds that fit all markers
    const latitudes = this.#workouts.map(workouts => {
      return workouts.coords[0];
    });
    const longitudes = this.#workouts.map(workouts => {
      return workouts.coords[1];
    });
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLong = Math.min(...longitudes);
    const maxLong = Math.max(...longitudes);
    // adjust fit bounds with coordinates
    this.#map.fitBounds(
      [
        [maxLat, minLong],
        [minLat, maxLong],
      ],
      { padding: [60, 60] }
    );
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
