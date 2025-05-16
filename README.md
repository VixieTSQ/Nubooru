<h1 align="center">Nubooru</h1>
<div align="center">
    <strong>
        A better Gelbooru client
    </strong>
</div>

<br>

<p align="center">
    <img align="center" alt="A gif showcasing Nubooru's various features" src="/static/nubooru.gif"></img>
</p>

<br>

* Smart upscales thumbnails live in your browser. (Uses WebGPU!)
* Entirely progressively enhanced.
* Instant navigations.
* Fool-proof search input. Never look up a cheat sheet again!
* View tag descriptions without ever leaving the page.
* Not ugly!

## Roadmap

The more progress I made on this project the more I realized this really doesn't make all that much sense as a website at all. I'm certainly not going to host it. Though I had the idea to:

1. Migrate the project to a [Tauri](https://v2.tauri.app/) app or something of the sort. This is a much more sensible form to distribute the project and it would also likely speed up the app a bit, given we wouldn't have to proxy Gelbooru through the server and we could migrate a lot of the more performance intensive tasks to the backend, like upscaling.
2. Transition the project from a Gelbooru reskin, to some what a **booru combinator**. An app where you could login to all your different accounts from the major boorus, search them all simultaneously with a single unified search syntax, and scroll a customizable home page compiling newly uploaded posts from your favorite artists and tags, all in one place.

I'm sure it's obvious this would be a pretty large undertaking, but given I ever come about working on a 2.0 of this project, that is the direction I would go in. I'll probably rename the app to Multibooru. Nubooru is more of a working name anywho.

## License

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this program.  If not, see [<https://www.gnu.org/licenses/>](https://www.gnu.org/licenses/).
