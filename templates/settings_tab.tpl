
  <!-- <form action="{{ url_for('main_page') }}" method="post", class="custom_options"> -->
  <form action="" name="custom_options" id='options_form'>	
    <br>
    <h3>Distance max d'accrochage des POI</h3>
    <input type="text" name="snapdistance" value="50" onkeypress="WriteCookie();"> en mètre(s)
    <br>
    <h3>Sélection des POI</h3>

    <table>
	   	<tr>
	   		<th></th>
	   		<th>Avec nom</th>
	   		<th>Sans nom</th>
	   	</tr>
	   	<tr>
	   		<td>Tous</td>
	   		<td><input type="checkbox" name="select-all" id="select_all_with_name"></td>
	   		<td><input type="checkbox" name="select-all" id="select_all_no_name"></td>
	   	</tr>
	   	<tr>
	   		<td>Sommet</td>
	   		<td><input type="checkbox" name="peak" class='with_name'></td>
	   		<td><input type="checkbox" name="peak" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Col</td>
	   		<td><input type="checkbox" name="saddle" class='with_name'></td>
	   		<td><input type="checkbox" name="saddle" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Refuge</td>
	   		<td><input type="checkbox" name="alpine_hut" class='with_name'></td>
	   		<td><input type="checkbox" name="alpine_hut" class='no_name'></td>
	   		<td><a href="http://wiki.openstreetmap.org/wiki/FR:Tag:tourism%3Dalpine_hut" role="tab" target="_blank">link</a></td>
	   	</tr>
	   	<tr>
	   		<td>Refuge non gardé</td>
	   		<td><input type="checkbox" name="wilderness_hut" class='with_name'></td>
	   		<td><input type="checkbox" name="wilderness_hut" class='no_name'></td>
	   		<td><a href="http://wiki.openstreetmap.org/wiki/FR:Tag:tourism%3Dwilderness_hut" role="tab" target="_blank">link</a></td>
	   	</tr>
	    <tr>
	   		<td>Attraction touristique</td>
	   		<td><input type="checkbox" name="attraction" class='with_name'></td>
	   		<td><input type="checkbox" name="attraction" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Chateau</td>
	   		<td><input type="checkbox" name="castle" class='with_name'></td>
	   		<td><input type="checkbox" name="castle" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Grotte</td>
	   		<td><input type="checkbox" name="cave_entrance" class='with_name'></td>
	   		<td><input type="checkbox" name="cave_entrance" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Chapelle</td>
	   		<td><input type="checkbox" name="chapel" class='with_name'></td>
	   		<td><input type="checkbox" name="chapel" class='no_name'></td>
	   	</tr>

	   	<tr>
	   		<td>Fontaine</td>
	   		<td><input type="checkbox" name="fountain" class='with_name'></td>
	   		<td><input type="checkbox" name="fountain" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Glacier</td>
	   		<td><input type="checkbox" name="glacier" class='with_name'></td>
	   		<td><input type="checkbox" name="glacier" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Panneau</td>
	   		<td><input type="checkbox" name="guidepost" class='with_name'></td>
	   		<td><input type="checkbox" name="guidepost" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Lac</td>
	   		<td><input type="checkbox" name="lake" class='with_name'></td>
	   		<td><input type="checkbox" name="lake" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Observatoire</td>
	   		<td><input type="checkbox" name="observatory" class='with_name'></td>
	   		<td><input type="checkbox" name="observatory" class='no_name'></td>
	   	</tr>

	   	<tr>
	   		<td>Table d'orientation</td>
	   		<td><input type="checkbox" name="toposcope" class='with_name'></td>
	   		<td><input type="checkbox" name="toposcope" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Arbre remarquable</td>
	   		<td><input type="checkbox" name="tree" class='with_name'></td>
	   		<td><input type="checkbox" name="tree" class='disabled' disabled></td>
	   	</tr>
	   	<tr>
	   		<td>Ruines</td>
	   		<td><input type="checkbox" name="ruins" class='with_name'></td>
	   		<td><input type="checkbox" name="ruins" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Source</td>
	   		<td><input type="checkbox" name="spring" class='with_name'></td>
	   		<td><input type="checkbox" name="spring" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Abri</td>
	   		<td><input type="checkbox" name="shelter" class='with_name'></td>
	   		<td><input type="checkbox" name="shelter" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Point de vue</td>
	   		<td><input type="checkbox" name="viewpoint" class='with_name'></td>
	   		<td><input type="checkbox" name="viewpoint" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Eau potable</td>
	   		<td><input type="checkbox" name="drinking_water" class='with_name'></td>
	   		<td><input type="checkbox" name="drinking_water" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Cascade</td>
	   		<td><input type="checkbox" name="waterfall" class='with_name'></td>
	   		<td><input type="checkbox" name="waterfall" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Lieu-dit</td>
	   		<td><input type="checkbox" name="locality" class='with_name'></td>
	   		<td><input type="checkbox" name="locality" class='no_name'></td>
	   		<td><a href="https://wiki.openstreetmap.org/wiki/FR:Tag:place%3Dlocality" role="tab" target="_blank">link</a></td>
	   	</tr>

	   	<tr>
	   		<td>Toilettes</td>
	   		<td><input type="checkbox" name="toilets" class='with_name'></td>
	   		<td><input type="checkbox" name="toilets" class='no_name'></td>
	   	</tr>
	    <tr>
	   		<td>Gué</td>
	   		<td><input type="checkbox" name="ford" class='with_name'></td>
	   		<td><input type="checkbox" name="ford" class='no_name'></td>
	   		<td><a href="http://wiki.openstreetmap.org/wiki/FR:Key:ford" role="tab" target="_blank">link</a></td>
	   	</tr>
	   	<tr>
	   		<td>Tunnel</td>
	   		<td><input type="checkbox" name="tunnel" class='with_name'></td>
	   		<td><input type="checkbox" name="tunnel" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Barrière</td>
	   		<td><input type="checkbox" name="barrier" class='with_name'></td>
	   		<td><input type="checkbox" name="barrier" class='no_name'></td>
	   	</tr>

</table>
<br>
<h3>Inverser la trace</h3>
<input type="checkbox" name="reverse_track">
<br>
<br>
<!-- <input type="submit" value="Submit"> -->
<input type="button" value="Envoyer" id='submit_options' onclick="WriteCookie();"/>
</form>




<script type="text/javascript">


    $('#select_all_with_name').click(function(event) {
        if(this.checked) {
            $(':checkbox.with_name').prop('checked', true);
        } else {
            $(':checkbox.with_name').prop('checked', false);
        }
    });

    $('#select_all_no_name').click(function(event) {
        if(this.checked) {
            $(':checkbox.no_name').prop('checked', true);
        } else {
            $(':checkbox.no_name').prop('checked', false);
        }
    });

    // $('.with_name').click(function(event) {
    //     Cookies.set(this.name, this.checked);
    // });

	function WriteCookie()
	    {
	       input = escape(document.custom_options.snapdistance.value);
	       if( isNaN(input) || input < 1 || input > 1000) {
	       		alert('Cette valeur doit être comprise entre 1 et 1000');
			}else{
				Cookies.set("snapdistance", input);
			}

	       input = document.custom_options.reverse_track.checked;
	       Cookies.set("reverse", input);

	       // input = document.custom_options.reverse_track.checked;

			// var $formNode = document.getElementById('options_form');
			// var myFormObj = formToObject($formNode);
			// console.log(myFormObj);
			// Cookies.set("checkbox", myFormObj);
			// var ch = $('.with_name:checkbox:checked')
			// console.log(ch.name)
			// console.log( $(":checkbox.with_name").jsonify())
			Cookies.set("wpt", $(":checkbox.with_name").jsonify());
			Cookies.set("wpt_no_name", $(":checkbox.no_name").jsonify());
			// console.log($("#options_form").jsonify())

// $('.theClass:checkbox:checked')
	    }
     
	$( document ).ready(function() {
		$(':checkbox.with_name').prop('checked', true);
		$(':checkbox.no_name').prop('checked', true);
		$(':checkbox[name="tunnel"]').prop('checked', false);
		$(':checkbox[name="ford"]').prop('checked', false);
		$(':checkbox[name="barrier"]').prop('checked', false);
		$(':checkbox.no_name[name="guidepost"]').prop('checked', false);


		if (Cookies.get('snapdistance') != null){
			document.custom_options.snapdistance.value = Cookies.get('snapdistance');
		}
	});


  

</script>