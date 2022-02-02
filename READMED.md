# Mapty

JavaScript learning Project for an online Application running entirely in the browser.

## CONTENTS OF THIS FILE

- Introduction
- Architecture
- Installation
- Motivation
- License
- Contributors

## Introduction

This application renders workouts based on the user's location.

A workout that could be chosen:

- Running
- Cycling

The app gets the current location from the browser and passes those cords into a library which renders a map on the position where the user can then initialize workouts by simple click events.

As soon as a workout gets submitted mapty will process the user data makes several ajax calls in the background and show the user the corresponding information for

- the weather
- the location
- calculations (pace, speed)

The UI can be manipulated from the user by:

- Editing workouts
- Deleting workouts
- Deleting all workouts
- Sorting workouts
- Navigating the map on the corresponding workouts on the map
- Overview of all workouts

### Bugs / Improvement

The application relies on servers, which do not allow by default to do as many API calls as you wish, there for registering to get an API key solves that problem.

There are still a tones of possibilities to improve and refacter the application for example

- Connecting a database
- Using another library to get unique Id's for each workout
- Features for drawing
- Features for rendering the map spot from A to B

## Architecture

![Architexture Plan](./Architecture/Mapty_Architecture_Plan.png);

### OOP

- Workout class parent
- - Running Workout class child
- - Cycling Workout class child

- APP class
  Creating instances from running, cycling workouts.
  Holding all the underlying data of the application, which deals with the User Interface.

#### Data

#### Libraries

- Leaftlet

### Apis

- https://geocode.xyz/
- https://openweathermap.org/api

The project does not include the whole data flow. It shows the main flow and function calls between each class.

- Data is stored in local storage

## INSTALLATION

Install npm and run npm init.

## Motivation

I really felt engaged in developing the project. I learned a lot by coding on it and building and refactoring all the new features, which I mentioned in the introduction.

## License

This was a learning project for a portfolio project! You can not claim it as your own or use it to teach.
@copyright @jonasschmedtmann

## Contributors

- Jonas Schmedtmann - https://github.com/jonasschmedtmann
- Benjamin Scharf - https://github.com/BenChis
