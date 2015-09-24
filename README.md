#Shared-State

In this folder you will find the Shared-State library developed for [MediaScape project](http://mediascapeproject.eu/).

## Navigation
[Goals][] | [Structure][] | [Authors][] | [License][]

### Goals

MediaScape targets applications that provide shared experiences across multiple devices.

Shared data is a basic building block in MediaScape. Data synchronization is a central challenge in multi-device application, especially when shared, server-side objects may be modified at any time. A generic service is developed focusing on low update latency, quick onchange notification, consistency among observing clients as well as efficiently providing connecting clients with current state. The service is intended primarily for relatively small volumes of JSON data essential for the application. 

### Structure

  * [API](API/): The JavaScript API.
  * [helloworld](helloworld/): minimal sample code.
  * [Server](Server/): The serverside code

### Authors

- Njål Borch (njaal.borch@norut.no)
- Andreas Bosl (bosl@irt.de)

### License

Unless otherwise stated:

Copyright 2015 Norut Tromsø, Norway.  
Copyright 2015 IRT Munich, Germany.

Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

[Goals]: #goals
[Structure]: #structure
[Authors]: #authors
[License]: #license
