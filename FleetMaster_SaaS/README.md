# 🚀 FleetMaster Pro: Enterprise Fleet Tracking & Management SaaS

Welcome to the **FleetMaster Pro** repository! 

This project is a complete, cloud-native Software as a Service (SaaS) platform built for schools, colleges, and transport companies. It allows institutions to track their buses in real-time, manage student attendance on the go, calculate dynamic AI-driven ETAs based on actual traffic speeds, and monitor safety alerts.

This documentation is written to be understood by **everyone**—from senior engineers to absolute beginners. It breaks down exactly what we built, why we built it, and how every single line of code works.

---

## 📑 Table of Contents
1. [The Grand Vision (How the System Works)](#1-the-grand-vision-how-the-system-works)
2. [The Tech Stack (Tools We Used)](#2-the-tech-stack-tools-we-used)
3. [The AWS Backend (Databases & APIs)](#3-the-aws-backend-databases--apis)
   - [DynamoDB (The Vaults)](#dynamodb-the-vaults)
   - [AWS Lambda (The Python APIs)](#aws-lambda-the-python-apis)
4. [The Frontend Applications (HTML/JS)](#4-the-frontend-applications-htmljs)
   - [index.html (Secure Login)](#indexhtml-secure-login)
   - [admin.html (God Mode Dashboard)](#adminhtml-god-mode-dashboard)
   - [driver.html (GPS Broadcaster)](#driverhtml-gps-broadcaster)
   - [student.html (Live Radar & ETA)](#studenthtml-live-radar--eta)
   - [conductor.html (Attendance Engine)](#conductorhtml-attendance-engine)
5. [The Math: Dynamic ETA & Speed](#5-the-math-dynamic-eta--speed)

---

## 1. The Grand Vision (How the System Works)
Imagine a busy school morning. 
1. The **Admin** draws a bus route on their computer screen.
2. The **Driver** gets in the bus, opens an app on their phone, and starts broadcasting their GPS location to space.
3. The **Conductor** stands at the bus door with an iPad, tapping "Present" or "Absent" as kids get on.
4. The **Parent/Student** looks at their phone and sees a live bus moving on a map, with a countdown timer showing exactly when it will arrive at their house.

To make all these different phones and computers talk to each other in real-time, we built a **Serverless Cloud Architecture**. Instead of renting a physical computer server, we use Amazon Web Services (AWS) to act as an invisible, highly secure middleman.

---

## 2. The Tech Stack (Tools We Used)
* **Frontend:** Pure HTML5, CSS3, and Vanilla JavaScript. (No heavy frameworks like React so the apps load instantly on slow mobile networks).
* **Mapping:** Leaflet.js (for drawing the maps) and OSRM (Open Source Routing Machine, to magically snap straight lines to actual roads).
* **Authentication:** AWS Cognito (Enterprise-grade 256-bit encryption for logging in).
* **Database:** AWS DynamoDB (A lightning-fast NoSQL database).
* **Backend Logic:** AWS Lambda (Python 3.12 scripts that process our data).

---

## 3. The AWS Backend (Databases & APIs)

For a beginner, think of the cloud like a giant bank. 
* **DynamoDB** is the bank vault where we store the money (data).
* **AWS Lambda** is the bank teller. Our websites cannot go directly into the vault; they must hand a request to the Lambda teller, who goes into the vault, gets the data, and hands it back to the website securely.

### DynamoDB (The Vaults)
We created three separate tables:
1. `FleetMaster_Routes` *(Partition Key: route_id)*: Stores the physical bus stops drawn by the Admin.
2. `FleetMaster_LiveGPS` *(Partition Key: bus_id)*: Stores the exact Latitude and Longitude of a moving bus. It updates every 5 seconds.
3. `FleetMaster_Students` *(Partition Key: roll)*: Stores the names of the students and whether they are present or absent.

### AWS Lambda (The Python APIs)
Here are the actual Python scripts we wrote to act as our "Bank Tellers".

#### A. The GPS Engine
**1. SaveLiveGPS** (Receives GPS from the Driver and saves it)
```python
import json
import boto3
import time
from decimal import Decimal

# Connect to the DynamoDB vault
dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('FleetMaster_LiveGPS')

def lambda_handler(event, context):
    try:
        # Open the envelope sent by the driver's phone
        body = json.loads(event['body'], parse_float=Decimal)
        
        # CRITICAL: We stamp the exact millisecond this signal was received. 
        # The Student App uses this timestamp to calculate how fast the bus is moving!
        body['timestamp'] = int(time.time() * 1000)
        
        # Shove it into the database
        table.put_item(Item=body)
        
        return { 'statusCode': 200, 'body': json.dumps('GPS Ping Saved Successfully!') }
    except Exception as e:
        return { 'statusCode': 500, 'body': json.dumps(f"Error saving GPS: {str(e)}") }
```

**2. GetLiveGPS** (Reads the database and sends it to the Student/Admin map)
```python
import json
import boto3
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('FleetMaster_LiveGPS')

# Helper function to prevent web browsers from crashing when reading decimal numbers
def decimal_default(obj):
    if isinstance(obj, Decimal): return float(obj)
    raise TypeError

def lambda_handler(event, context):
    try:
        # Reach in and grab the exact location of Bus 1
        response = table.get_item(Key={'bus_id': 'bus_1'})
        
        if 'Item' in response:
            return {
                'statusCode': 200,
                'body': json.dumps(response['Item'], default=decimal_default)
            }
        else:
            return { 'statusCode': 404, 'body': json.dumps({"error": "Bus offline"}) }
    except Exception as e:
        return { 'statusCode': 500, 'body': json.dumps(str(e)) }
```

#### B. The Attendance Engine
**3. SaveFleetStudent** (Saves a new student or updates their attendance)
*Beginner note: This uses an "Upsert" trick. If we send a student with Roll Number "101", AWS saves it. If we send "101" again later with the status "Present", AWS doesn't create a duplicate; it just magically updates the existing one!*
```python
import json
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('FleetMaster_Students')

def lambda_handler(event, context):
    try:
        # Parse the student data from the Conductor app
        body = json.loads(event['body'])
        
        # Save or update them in the database
        table.put_item(Item=body)
        
        return { 'statusCode': 200, 'body': json.dumps('Student successfully saved!') }
    except Exception as e:
        return { 'statusCode': 500, 'body': json.dumps(str(e)) }
```

**4. GetFleetStudents** (Downloads all students to the Conductor app)
```python
import json
import boto3

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table('FleetMaster_Students')

def lambda_handler(event, context):
    try:
        # .scan() reads every single item in the entire table
        response = table.scan()
        students = response.get('Items', [])
        
        return { 'statusCode': 200, 'body': json.dumps(students) }
    except Exception as e:
        return { 'statusCode': 500, 'body': json.dumps(str(e)) }
```

---

## 4. The Frontend Applications (HTML/JS)

We built 5 separate web pages. Here is exactly what each one does and the clever tricks hidden inside the code.

### `index.html` (Secure Login)
**What it is:** The front door of the SaaS. It prevents unauthorized access.
**How it works:** We used `amazon-cognito-identity-js`. We do not write code to verify passwords ourselves—that is a security risk. Instead, our JavaScript packages the user's ID and password, sends it to AWS Cognito, and AWS does the math to verify if they are real. It handles "First Time Login" password changes automatically.

### `driver.html` (GPS Broadcaster)
**What it is:** A simple app the driver keeps open on their phone.
**How it works:**
We use the browser's built in satellite connection: `navigator.geolocation.watchPosition()`. 
*Beginner trick:* We don't use `getCurrentPosition()` (which only asks for the location once). We use `watchPosition()`. This stays awake forever. Every time the phone detects it has moved a few meters, it automatically triggers a `fetch()` request to push the new coordinates to our `SaveLiveGPS` Lambda function.

### `conductor.html` (Attendance Engine)
**What it is:** A mobile-first list of students for the bus assistant to take attendance.
**How it works:**
1. **Fat-Finger UI:** We specifically designed the CSS buttons (Present/Absent) to be 44x44 pixels. This prevents the conductor from accidentally tapping the wrong button while standing on a bumpy bus.
2. **The Magic Phone Button:** We hid the phone numbers to save screen space, and instead added a `📞` button with the code `<a href="tel:+919876543210">`. On a real mobile phone, clicking this instantly opens the phone's native dialer app!

### `student.html` (Live Radar & ETA)
**What it is:** The app for parents to track the bus.
**How it works:**
1. **Downloading the Route:** It reaches out to AWS to download the stops the Admin drew.
2. **OSRM Road Snapping:** If we draw a line between Stop 1 and Stop 2, it's just a straight blue line going through buildings. We send those coordinates to the OSRM API, which uses real road data to bend the blue line so it accurately follows highways and streets.
3. **The Timeline Math:** The code constantly checks the distance between the bus and the bus stops. If the distance drops below 40 meters, the code crosses out the stop and marks it as "Passed".

### `admin.html` (God Mode Dashboard)
**What it is:** The Command Center for the School Principal or Fleet Manager.
**How it works:**
1. **Route Builder:** Clicking the map drops Leaflet markers. The JS code pushes these into an array and saves them to AWS. We used an HTML5 `<datalist>` for the Bus ID so the Admin can either pick from a dropdown or type a custom bus plate number.
2. **Live Fleet Dashboard (God Mode):**
   * Uses `setInterval(refreshLiveFleet, 5000)` to automatically ping AWS every 5 seconds without the user ever having to refresh the page.
   * It downloads the Students database to show exactly how many kids are Present vs Absent.
   * **Safety Telemetry Alert:** It calculates the bus's speed (see section below). If the driver exceeds 60 km/h, the JavaScript triggers `document.getElementById('safety-alert-banner').style.display = 'block'`, slamming a massive red warning onto the Principal's screen!

---

## 5. The Math: Dynamic ETA & Speed

The most complex and powerful part of this SaaS is that we do not use fake, hardcoded speeds (like assuming the bus always travels at 40km/h). **We calculate actual physics in real-time.**

Here is how the algorithm works in both `student.html` and `admin.html`:

1. **Step 1:** The app remembers where the bus was on the *last* ping, and notes the exact timestamp.
2. **Step 2:** A new ping arrives 5 seconds later. The app checks the new location.
3. **Step 3:** We use the map to measure the exact distance traveled in meters.
4. **Step 4:** We calculate the time difference between the two pings in hours.
5. **Step 5 (Speed = Distance / Time):** We divide the distance by the time to get the `instantSpeed`.
6. **Step 6 (The Failsafe):** GPS isn't perfect. Sometimes a satellite glitch thinks a phone teleported 10 miles in 1 second. We added a failsafe: `if (instantSpeed > 120) instantSpeed = 120;`.
7. **Step 7 (Moving Average):** To stop the ETA from jumping wildly from 5 minutes to 20 minutes and back, we blend the new speed with the old speed: `currentSpeed = (oldSpeed * 0.5) + (newSpeed * 0.5)`. 
8. **Step 8:** We take the distance left to the parent's house, divide it by this highly accurate Dynamic Speed, and display the final ETA.

---

---

## Appendix: Core JavaScript Engines

If you are curious about the actual code powering the physics, telemetry, and safety alerts in the browser, here are the core JavaScript engines used across the FleetMaster Pro ecosystem.

### 1. The Telemetry Broadcaster (Driver App Loop)
*This is the engine running inside `driver.html` that maintains a permanent connection to space satellites and pushes data to AWS.*

```javascript
// We ask the phone's GPS to create a permanent, open connection to the satellites
watchId = navigator.geolocation.watchPosition((position) => { 
    // Extract exact Latitude and Longitude
    let lat = position.coords.latitude;
    let lng = position.coords.longitude;
    
    // Fire the data to our AWS Lambda "SaveLiveGPS" function instantly
    fetch(apiUrl, { 
        method: 'POST', 
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ bus_id: "bus_1", lat: lat, lng: lng }) 
    });
}, (error) => { console.error("GPS Error:", error); }, 
{ enableHighAccuracy: true, maximumAge: 0, timeout: 10000 });
```

### 2. The AI Radar & Math Engine (Student App)
*This is the physics math running inside `student.html` that calculates the dynamic ETA without relying on hardcoded speed estimates.*

```javascript
// 1. Calculate the distance moved since the last ping
const distMeters = map.distance([lastLat, lastLng], newLatLng);

// 2. Calculate the time difference in hours
const timeDiffHours = (newPingTime - lastPingTime) / 3600000; 

// 3. Physics: Speed = Distance / Time
let instantSpeed = (distMeters / 1000) / timeDiffHours;

// 4. Failsafes to prevent GPS glitches from breaking the app
if (instantSpeed < 3) instantSpeed = 3; // Prevent Infinity ETA at red lights
if (instantSpeed > 120) instantSpeed = 120; // Prevent supersonic speeds

// 5. Exponential Moving Average for a smooth, jump-free countdown timer
currentDynamicSpeedKmH = (currentDynamicSpeedKmH * 0.5) + (instantSpeed * 0.5); 
```

### 3. The Command Center (Admin App)
*This is the auto-polling engine and safety telemetry running inside `admin.html` that triggers the visual Red Alert.*

```javascript
// The Auto-Polling Engine (Runs every 5 seconds without refreshing the page)
window.adminFleetInterval = setInterval(refreshLiveFleet, 5000);

// Inside refreshLiveFleet(): The Red Alert Trigger
let displaySpeed = Math.round(adminCurrentSpeed);

if (displaySpeed > 60) {
    // 🚨 Over-speeding detected! Drop the red banner.
    document.getElementById('safety-alert-banner').style.display = 'block';
    document.getElementById('admin-live-speed').style.color = '#ff416c';
} else {
    // Safe speed. Hide banner.
    document.getElementById('safety-alert-banner').style.display = 'none';
    document.getElementById('admin-live-speed').style.color = '#ff9800';
}
```
---
{date:16/03/2026}
## Version 2.0 Update: The Relational Data Hub (Fleet Registry)
**Date:** March 2026 | **Phase:** Multi-Tenant Architecture

### 1. The Objective
In Version 1.0 (MVP), the platform relied on hardcoded vehicle identifiers (e.g., "bus_1", "bus_2") embedded directly into the HTML dropdowns and JavaScript logic. To scale into a multi-tenant Enterprise SaaS, we needed a dynamic, cloud-hosted registry where administrators can register any number of vehicles and drivers, which automatically syncs across the entire platform.

### 2. AWS Cloud Architecture
* **DynamoDB Table:** Created a new table named `FleetMaster_Registry`.
    * **Partition Key:** `bus_id` (Type: String) - Serves as the unique system identifier for the vehicle.
* **Lambda Function (API):** Created a Python 3.x function named `ManageFleetRegistry`.
    * **CORS Settings:** Allowed Origins (`*`), Methods (`*`), and Headers (`*`).
    * **Logic (POST):** Accepts a JSON payload containing `bus_id`, `license_plate`, `driver_name`, and `driver_phone`, and writes it to the DynamoDB table using `boto3`.
    * **Logic (GET):** Performs a `.scan()` on the table to return an array of all registered vehicles to the frontend.

### 3. Frontend Integration (`admin.html`)
* **UI Navigation:** Added a new "Data Hub (Registry)" tab to the sidebar navigation.
* **Data Hub Form:** Built a user interface for admins to input vehicle and driver details.
* **Javascript Engine:** * Implemented `registerVehicle()`: Captures form data, packages it into a JSON payload, and sends a `POST` request to the Lambda API.
    * Implemented `loadBusesIntoDropdown()`: Fires automatically on page load and after every new registration. It sends a `GET` request to the Lambda API, parses the JSON, and dynamically populates the `<datalist id="bus-options">` in the Route Builder tab.

### 4. Result
The Admin can now add a new vehicle in the Data Hub, and it becomes instantaneously available for assignment in the Route Builder without writing a single line of code.

## Version 2.1 Update: Smart Fleet Broadcaster (Driver App)
**Date:** March 2026 | **Phase:** Multi-Tenant Architecture

### 1. The Objective
The MVP version of the Driver App (`driver.html`) hardcoded `"bus_1"` into every GPS payload sent to AWS. This prevented multiple drivers from using the system simultaneously. We needed to make the Driver App "smart" by connecting it to the new `FleetMaster_Registry` so drivers can dynamically claim their assigned vehicle before starting a trip.

### 2. Frontend Integration (`driver.html`)
* **UI Upgrade:** Removed hardcoded text and implemented a dynamic `<select>` dropdown menu to display available vehicles on startup.
* **Initialization Logic:** Created `loadFleet()`, an async function that sends a `GET` request to `ManageFleetRegistry` Lambda on page load, parsing the JSON to populate the dropdown with real Driver Names and License Plates.
* **Validation & Lock-in:** Updated `startTracking()` to block execution if a vehicle is not selected. Once selected, the UI hides the dropdown to prevent mid-trip errors and displays a permanent "Active: [Driver Name]" badge.
* **Dynamic Telemetry:** Updated `sendLocationToServer(lat, lng)` to inject the globally scoped `selectedBusId` into the JSON payload sent to the `FleetMaster_LiveGPS` database.

### 3. Result
100 different drivers can now log into the Driver App on their own phones, select their specific bus, and broadcast unique, parallel GPS streams to the cloud without overriding each other's data.

## Version 2.2 Update: Smart Session Context (Conductor App)
**Date:** March 2026 | **Phase:** Multi-Tenant Architecture

### 1. The Objective
The MVP Conductor App (`conductor.html`) immediately loaded the student roster upon opening and displayed a hardcoded header ("Bus 1"). To support multiple simultaneous routes, the Conductor App needed a setup gateway identical to the Driver App, ensuring the UI reflects the actual vehicle being operated.

### 2. Frontend Integration (`conductor.html`)
* **UI Architecture:** Wrapped the core attendance application inside a hidden `div` (`main-app`) and injected a new `setup-section` at the top of the DOM. 
* **Dynamic Loading:** Implemented `loadFleet()` to fetch the live registry from `ManageFleetRegistry` Lambda and populate a `<select>` dropdown.
* **Execution Control:** Commented out the auto-executing `loadStudentsFromCloud()` at the bottom of the script. It is now only invoked inside the new `startConductorSession()` function.
* **Context Setting:** When the conductor selects a bus and clicks start, the app hides the setup screen, displays the roster, and dynamically injects the chosen Driver/Bus name into the top Navigation Header for situational awareness.

### 3. Next Steps (Roadmap Note)
*Future integration with AWS Cognito User Pools is planned to securely link these dropdown selections to authenticated driver/conductor login credentials, replacing this honor-system dropdown.*

## Version 2.3 Update: The Student/Parent Data Hub

**Date:** March 2026 | **Phase:** Multi-Tenant Architecture



### 1. The Objective

Previously, the system lacked a frontend interface for administrators to enroll new students into the tracking ecosystem. We needed a UI within the Admin Dashboard that allows management to create student profiles, link parent contact information, and assign them to specific vehicles and physical stops.



### 2. Frontend Integration (`admin.html`)

* **UI Expansion:** Added a secondary "Register New Student & Parent" card within the Data Hub tab. 

* **Dynamic Data Binding:** Modified the existing `loadBusesIntoDropdown()` function. When it fetches the active vehicle registry from AWS, it now populates *both* the Route Builder `<datalist>` and the new Student Registration `<select>` dropdown simultaneously.

* **Database Pipeline (`registerStudent`):** * Captures `name`, `roll` (User ID), `phone`, `bus_id`, and `stop`.

    * Packages the data into a JSON payload formatted exactly as the Conductor App expects.

    * Re-uses the existing `SAVE_STUDENT_API_URL` (Lambda API) to `POST` the new record directly into the `FleetMaster_Students` DynamoDB table.



### 3. Result

The ecosystem is now fully looped. An administrator can register a new bus, then register a new student and assign them to that bus. The moment this is done, that student will automatically appear on the assigned Conductor's mobile app, and the Parent can log in to track that specific bus. 


## Version 2.4 Update: Session State Management & Relational Route Sync
**Date:** March 2026 | **Phase:** Multi-Tenant Architecture

### 1. The Architecture Flaw Identified
In the MVP, the `student.html` application suffered from an isolated state leak. When AWS Cognito authenticated a user in `index.html`, the user's identity was lost during the browser redirect. Without knowing *who* the parent was, `student.html` blindly fetched the last created route from the `FleetMaster_Routes` database, resulting in parents potentially seeing the wrong bus. Furthermore, legacy manual Route Builder UI elements remained in the parent-facing portal.

### 2. Frontend State Integration (`index.html` & `student.html`)
* **State Preservation:** Updated the AWS Cognito `onSuccess` callback in `index.html` to inject the `user` (Roll Number) into the browser's persistent `localStorage`.
* **UI Refactoring:** Gutted the manual pin-dropping and "Download Route" buttons from `student.html`. Replaced them with an automated `<div id="setup-banner">` that provides visual synchronization feedback to the parent.
* **Smart Sync Logic (`autoInitializeParentPortal`):**
    1. Retrieves the `fleetmaster_user_id` from `localStorage`.
    2. Performs a `GET` fetch to the `FleetMaster_Students` API to locate the user's relational profile and extracts their `assigned_bus`.
    3. Performs a `GET` fetch to the `FleetMaster_Routes` API to isolate and download *only* the specific route mapped to that `assigned_bus`.
    4. Automatically plots the designated stops and seamlessly transitions the application into Live Tracking mode via `startTrackingMode()`.

### 3. Result
The Parent application is now completely hands-free and context-aware. A parent logs in, and the application autonomously queries the database relational chain (User -> Student Profile -> Assigned Bus -> Assigned Route) to render a 100% accurate, personalized tracking dashboard.

## Version 2.5 Update: TAM Expansion & Top 1% Physics Engine
**Date:** March 2026 | **Phase:** Enterprise Feature Enrichment & Production Readiness

### 1. The Objective
To support private fleets (vans, auto-rickshaws, cars), the platform needed dynamic vehicle-type intelligence and geospatial "Home Pin" capabilities to provide visual proximity mapping for parents. Furthermore, the consumer-facing Parent App (`student.html`) required an enterprise-grade physics engine to isolate fleet data, smooth out GPS jitter, and dynamically render custom map icons based on the relational database.

### 2. Admin Frontend & Database Pipeline (`admin.html`)
* **Vehicle Type Support:** Added a `<select id="reg-type">` dropdown to the Vehicle Registration form to support School Buses, Mini-Vans, Autos, and Cars.
* **Geospatial Mini-Map:** Integrated a localized Leaflet map (`initHomeMap()`) directly into the Student Registration card. Administrators click the map to extract precise `home_lat` and `home_lng` coordinates.
* **Dual-Routing Profile:** Split the generic "stop" field into `morning_stop` and `evening_stop`.
* **UX Formatting (+91 Auto-Fill):** Upgraded the phone number input fields with a locked flexbox prefix (`+91`), stripping redundant typing for administrators while guaranteeing standardized formatting for the database.
* **Boto3/DynamoDB Serialization Fix:** Patched a critical silent crash where AWS DynamoDB rejected floating-point map coordinates. Intercepted `selectedHomeLat` and `selectedHomeLng` on the frontend and cast them to `String` data types before payload transmission.
* **Backward Compatibility:** Restored the legacy `stop` JSON key to ensure the Conductor App's attendance grouping algorithms do not break during the morning/evening stop transition.

### 3. Consumer Frontend & Physics Engine (`student.html`)
* **Relational Data Isolation:** Re-engineered the `fetchBusLocation()` polling engine. Instead of blindly pulling the latest GPS ping, the app now cross-references the student's `targetBusId` and surgically filters the AWS payload to ensure parents only track their specific assigned vehicle.
* **Exponential Moving Average (EMA) Speed Math:** Implemented a physics layer that calculates the distance and time deltas between GPS pings. Applied an EMA smoothing algorithm (`(oldSpeed * 0.5) + (newSpeed * 0.5)`) and strict speed caps to eliminate map jumping and supersonic GPS glitches.
* **Dynamic Leaflet Rendering:** Overrode the hardcoded Leaflet map markers. The system now parses the `vehicle_type` from the database and utilizes `.setIcon()` to dynamically swap between Unicode icons (🚌, 🚐, 🛺, 🚗) in real-time.
* **Offline Failsafes:** Programmed a timeout listener that marks the vehicle as "Offline / Ended Trip" if the timestamp of the last AWS ping exceeds 5 minutes.

### 4. Result
The Multi-Tenant Architecture is now mathematically and visually complete. Administrators can register diverse fleet types and plot exact student home coordinates. Drivers broadcast isolated telemetry. Parents receive a buttery-smooth, context-aware live tracking experience featuring their specific vehicle's icon, precise ETA calculations, and their personal home pinned on the map. The application is now primed for AWS Amplify Production Deployment.

---
*Built from scratch. Scaling the future of transport logistics.*
