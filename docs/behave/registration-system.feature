Feature: Festival registration system
  As a festival team
  I want the registration system to work through a Fly.io API
  So that visitors can register safely and operators can monitor registrations

  Background:
    Given the public website uses a dedicated HTTPS API endpoint for registration
    And the registration backend is deployed on Fly.io
    And the website registration form submits directly to the Fly.io API
    And the database stores personal data only as encrypted payloads plus blind indexes
    And ticket artifacts are published as static HTML, PDF and ICS files

  @happy_path @playwright @telethon
  Scenario: Successful registration for an open event
    Given an event "scientific-library-open" is open for registration with available seats
    When the visitor submits valid full name, email and Russian phone for that event
    Then the registration is created
    And the visitor sees the ticket page at "/ticket/<public_hash>" on the main site domain
    And the ticket page shows a 6-character short ticket ID
    And the ticket page shows the full venue address
    And the ticket page invites the visitor to add the event to a calendar
    And the ticket page offers Google Calendar, Apple Calendar and ICS options
    And the ticket page offers "Download PDF"
    And the ticket page says "Printing the ticket is not required"
    And the ticket page does not offer self-service cancellation
    And the superadmin receives a Telegram notification with visitor name, event, date, time and remaining seats

  @dedupe
  Scenario: Duplicate registration is blocked inside the same event
    Given an event "science-center-open" is open for registration
    And a visitor is already registered for that event with a normalized email and phone
    When the same visitor submits another registration for the same event
    Then the system rejects the registration
    And the visitor sees a duplicate-registration message

  @multi_event
  Scenario: The same visitor can register for another event
    Given a visitor is registered for event "science-center-open"
    And event "tretyakovka-open" is open for registration
    When the same visitor submits registration for event "tretyakovka-open"
    Then the system accepts the registration
    And the second registration belongs to a different event

  @past_event
  Scenario: Registration is blocked for a past event
    Given event "archive-event" is in the past
    When a visitor submits registration for "archive-event"
    Then the system rejects the registration
    And the visitor sees "Registration is closed: the event has already passed"

  @sold_out
  Scenario: Registration is blocked when seats are exhausted
    Given event "blockhouse-last-seat" has no free seats
    When a visitor submits registration for that event
    Then the system rejects the registration
    And the visitor sees "No seats left"

  @race_condition
  Scenario: Only one visitor gets the last seat
    Given event "last-seat-event" has exactly 1 free seat
    When 2 visitors submit registration for that event at the same time
    Then exactly 1 registration is successful
    And the other registration is rejected with "No seats left" or a retry message
    And the stored seats_taken value does not exceed capacity

  @ticket_artifacts
  Scenario: Ticket HTML and PDF are generated without a heavy browser pipeline
    Given an event "oceania-open" is open for registration
    When a visitor successfully registers for that event
    Then the backend generates a static HTML ticket page from a lightweight template
    And the backend generates a PDF ticket from the same ticket view-model
    And the backend generates an ICS calendar file from the same event data
    And the backend generates a long public hash and a unique 6-character short ticket ID
    And all generated artifacts are uploaded to the configured bucket
    And the database stores only the artifact URLs and encrypted personal payload

  @telegram_outage
  Scenario: Registration succeeds while Telegram API is temporarily unavailable
    Given event "scientific-library-open" is open for registration
    And Telegram delivery is temporarily unavailable
    When a visitor submits valid registration data
    Then the registration is still created
    And the ticket HTML and PDF are still generated
    And a pending notification is written to telegram_outbox
    When Telegram delivery is restored
    Then the queued notification is eventually sent

  @roles
  Scenario: The first starter becomes superadmin and operators are assigned explicitly
    Given no Telegram admin exists yet
    When user "first-admin" sends "/start" to the bot
    Then "first-admin" becomes superadmin
    And the bot shows button navigation after "/start"
    And the bot supports the "/help" command
    When user "second-user" sends "/start" to the bot
    Then "second-user" does not become admin automatically
    When the superadmin grants operator role to "second-user"
    Then "second-user" can open event reports and event-level exports

  @operator_tools
  Scenario: Operator receives report access and superadmin keeps emergency export access
    Given an operator exists in the system
    And registrations already exist for event "tretyakovka-open"
    When the operator requests the event report in Telegram
    Then the bot returns the participant list for that event
    And the Telegram interface shows masked email and phone
    And the bot can generate an XLSX file with event, name, email, phone and ticket link
    When Telegram remains unavailable for a long period
    Then the superadmin can use the protected emergency export endpoint

  @registration_switch
  Scenario: Registration is opened and closed from Telegram
    Given event "science-center-open" exists in the system
    And registration for that event is closed
    When the superadmin sends the open-registration command for "science-center-open"
    Then registration for "science-center-open" becomes open in the internal system
    When the superadmin sends the close-registration command for "science-center-open"
    Then registration for "science-center-open" becomes closed
    When an operator sends the open-registration command for "science-center-open"
    Then the command is rejected

  @privacy
  Scenario: Personal data is not stored in plaintext inside the database
    Given a visitor completed registration successfully
    Then the database does not store plaintext full name, email or phone in the registration row
    And the database stores encrypted payload fields and blind indexes only
