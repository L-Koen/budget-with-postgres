# Budget Project with Database
#### Unsupervised project as part of a Codecademy course
I added working with Docker myself.

## Description
One can use envelopes to manage a budget. 
You can:
- Get a list of all available envelopes and their remaining funds
- Create new envelopes
- Alter amount (or name) on a given envelope
- Transfer money between envelopes
- Delete empty envelopes

As the API is based on physical envelopes and money, it does not allow you to go into the red.
For detailed usage, see the openAPI specification of all the endpoints and their usage.

## Usage
Create a .env file in the main directory with the following keys:
POSTGRESDB_USER=postgres
POSTGRESDB_ROOT_PASSWORD=my_secret_password
POSTGRESDB_DATABASE=envelopes_db
POSTGRESDB_LOCAL_PORT=5433
POSTGRESDB_DOCKER_PORT=5432
NODE_LOCAL_PORT=3000
NODE_DOCKER_PORT=3000

This will make the APP runs on port 3000 (localhost:3000/envelopes)

### Linux
run the containers with
UD="$(id -u)" GID="$(id -g)" docker-compose up
This will respect file permissions

### Windows
you can remove the user parts from the docker compose file, or just use UD=GID=1000.
then run: docker-compose up

### For development
What I do is alter the docker-compose file by uncommenting the stdin_open: true and tty: true lines, while commenting out the command: npm start line.
Then after running docker compose up, you can just attach a shell to the container of need.
