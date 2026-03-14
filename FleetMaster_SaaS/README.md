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
*Built from scratch. Scaling the future of transport logistics.*
