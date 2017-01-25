
  <!-- <form action="{{ url_for('main_page') }}" method="post", class="custom_options"> -->
  <form action="" name="custom_options">	
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
	   		<td><input type="checkbox" name="select-all_nn" id="select_all_no_name"></td>
	   	</tr>
	   	<tr>
	   		<td>Sommet</td>
	   		<td><input type="checkbox" name="peak" class='with_name'></td>
	   		<td><input type="checkbox" name="peak_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Col</td>
	   		<td><input type="checkbox" name="saddle" class='with_name'></td>
	   		<td><input type="checkbox" name="saddle_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Refuge</td>
	   		<td><input type="checkbox" name="alpine_hut" class='with_name'></td>
	   		<td><input type="checkbox" name="alpine_hut_nn" class='no_name'></td>
	   		<td><a href="http://wiki.openstreetmap.org/wiki/FR:Tag:tourism%3Dalpine_hut" role="tab" target="_blank">link</a></td>
	   	</tr>
	   	<tr>
	   		<td>Refuge non gardé</td>
	   		<td><input type="checkbox" name="wilderness_hut" class='with_name'></td>
	   		<td><input type="checkbox" name="wilderness_hut_nn" class='no_name'></td>
	   		<td><a href="http://wiki.openstreetmap.org/wiki/FR:Tag:tourism%3Dwilderness_hut" role="tab" target="_blank">link</a></td>
	   	</tr>
	   	<tr>
	   		<td>Barrière</td>
	   		<td><input type="checkbox" name="barrier" class='with_name'></td>
	   		<td><input type="checkbox" name="barrier_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Chateau</td>
	   		<td><input type="checkbox" name="castle" class='with_name'></td>
	   		<td><input type="checkbox" name="castle_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Grotte</td>
	   		<td><input type="checkbox" name="cave" class='with_name'></td>
	   		<td><input type="checkbox" name="cave_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Chapelle</td>
	   		<td><input type="checkbox" name="chapel" class='with_name'></td>
	   		<td><input type="checkbox" name="chapel_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Gué</td>
	   		<td><input type="checkbox" name="ford" class='with_name'></td>
	   		<td><input type="checkbox" name="ford_nn" class='no_name'></td>
	   		<td><a href="http://wiki.openstreetmap.org/wiki/FR:Key:ford" role="tab" target="_blank">link</a></td>
	   	</tr>
	   	<tr>
	   		<td>Fontaine</td>
	   		<td><input type="checkbox" name="fountain" class='with_name'></td>
	   		<td><input type="checkbox" name="fountain_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Glacier</td>
	   		<td><input type="checkbox" name="glacier" class='with_name'></td>
	   		<td><input type="checkbox" name="glacier_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Panneau</td>
	   		<td><input type="checkbox" name="guidepost" class='with_name'></td>
	   		<td><input type="checkbox" name="guidepost_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Lac</td>
	   		<td><input type="checkbox" name="lake" class='with_name'></td>
	   		<td><input type="checkbox" name="lake_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Observatoire</td>
	   		<td><input type="checkbox" name="observatory" class='with_name'></td>
	   		<td><input type="checkbox" name="observatory_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Toilettes</td>
	   		<td><input type="checkbox" name="toilets" class='with_name'></td>
	   		<td><input type="checkbox" name="toilets_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Table d'orientation</td>
	   		<td><input type="checkbox" name="toposcope" class='with_name'></td>
	   		<td><input type="checkbox" name="toposcope_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Arbre remarquable</td>
	   		<td><input type="checkbox" name="tree" class='with_name'></td>
	   		<td><input type="checkbox" name="tree_nn" class='disabled' disabled></td>
	   	</tr>
	   	<tr>
	   		<td>Ruines</td>
	   		<td><input type="checkbox" name="ruins" class='with_name'></td>
	   		<td><input type="checkbox" name="ruins_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Source</td>
	   		<td><input type="checkbox" name="spring" class='with_name'></td>
	   		<td><input type="checkbox" name="spring_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Abri</td>
	   		<td><input type="checkbox" name="shelter" class='with_name'></td>
	   		<td><input type="checkbox" name="shelter_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Point de vue</td>
	   		<td><input type="checkbox" name="viewpoint" class='with_name'></td>
	   		<td><input type="checkbox" name="viewpoint_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Eau potable</td>
	   		<td><input type="checkbox" name="drinking_water" class='with_name'></td>
	   		<td><input type="checkbox" name="drinking_water_nn" class='no_name'></td>
	   	</tr>
	   	<tr>
	   		<td>Cascade</td>
	   		<td><input type="checkbox" name="waterfall" class='with_name'></td>
	   		<td><input type="checkbox" name="waterfall_nn" class='no_name'></td>
	   	</tr>


</table>
<br>
<h3>Inverser la trace</h3>
<input type="checkbox" name="invert_track">
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


	function WriteCookie()
	    {
	       input = escape(document.custom_options.snapdistance.value);
	       if( isNaN(input) || input < 1 || input > 1000) {
	       		alert('Ce nombre doit être compris entre 1 et 1000');
			}else{
				Cookies.set("snapdistance", input);
			}

	       cookievalue = document.custom_options.invert_track.value;
	       Cookies.set("invert", cookievalue);
	    }
     
	$( document ).ready(function() {
		$(':checkbox.with_name').prop('checked', true);
		if (Cookies.get('snapdistance') != null){
			document.custom_options.snapdistance.value = Cookies.get('snapdistance');
		}
	});


  

</script>