/** ***************************************************************
* Copyright 2020 Advanced Distributed Learning (ADL)
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
**************************************************************** */
import React, {useEffect} from 'react';
import { useRouteMatch, useParams, useHistory, Link, Switch, Route } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

import { Detail, Tags, Translations } from '../DetailComponents';
import { selectPattern, editPattern } from '../../actions/patterns';
import EditPattern from './EditPattern';


export default function PatternDetail() {
    const { url, path } = useRouteMatch();
    const dispatch = useDispatch();
    const history = useHistory();
    let { profileId, patternId } = useParams();

    useEffect(() => {
        dispatch(selectPattern(patternId));
    }, []);

    const pattern = useSelector((state) => state.application.selectedPattern);

    function handleEditPattern(values) {
        dispatch(editPattern(Object.assign({}, pattern, values)));
        history.push(url);
    }

    if (!pattern) return '';

    const belongsToAnotherProfile = pattern.parentProfile.parentProfile.uuid !== profileId;

    return (<>
        <Switch>
            <Route path={`${path}/edit`}>
                <EditPattern
                    pattern={pattern}
                    onEdit={handleEditPattern}
                    onCancel={() => history.push(url)}
                    root_url={url}
                />
            </Route>

            <Route exact path={path}>
                <>
                    {
                        belongsToAnotherProfile &&
                            <div className="usa-alert usa-alert--info padding-2 margin-top-2" >
                                <div className="usa-alert__body">
                                    <p className="usa-alert__text">
                                        This pattern belongs to {pattern.parentProfile.name}.
                                    </p>
                                </div>
                            </div>
                    }
                    <div className="grid-row">
                        <div className="desktop:grid-col-8">
                            <h2>{pattern.name}</h2>
                            <Detail title="id">
                                {pattern.iri}
                            </Detail>
                            <div className="grid-row">
                                <div className="grid-col-4">
                                    <Detail title="pattern type">
                                        {pattern.type}
                                    </Detail>
                                </div>
                                <div className="grid-col-4">
                                    <Detail title="primary or secondary">
                                        {pattern.primary ? 'Primary' : 'Secondary'}
                                    </Detail>
                                </div>
                            </div>
                            <Detail title="pattern name">
                                {pattern.name}
                            </Detail>
                            <Detail title="description">
                                {pattern.description}
                            </Detail>
                            <Detail title="translations">
                                <Translations translations={pattern.translations} linkable={true} />
                            </Detail>
                            <Detail title="tags">
                                <Tags tags={pattern.tags} />
                            </Detail>
                        </div>
                        <div className="desktop:grid-col-4 display-flex flex-column flex-align-end">
                            {
                                !belongsToAnotherProfile &&
                                    <Link
                                            to={`${url}/edit/`}
                                            className="usa-button padding-x-105 margin-top-2 margin-right-0 "
                                    >
                                        <span className="fa fa-pencil fa-lg margin-right-1"></span>
                                        Edit Pattern
                                    </Link>
                            }
                            <div className="details-metadata-box margin-top-2 width-full">
                                <Detail title="updated" >
                                    {(pattern.updatedOn) ? (new Date(pattern.updatedOn)).toLocaleDateString() : "Unknown"}
                                </Detail>
                                <Detail title="parent profile" >
                                    {pattern.parentProfile.name}
                                </Detail>
                                <Detail title="author" >
                                    {pattern.parentProfile.organization.name}
                                </Detail>
                            </div>
                        </div>
                    </div>
                    <PatternComponentsTable components={pattern[pattern.type]} patternType={pattern.type} />
                </>
            </Route>
        </Switch>
    </>);
}

function PatternComponentsTable({ components, patternType }) {
    // let singleComponent = (patternType !== 'sequence' && patternType !== 'alternates');
    let singleComponent = false;
    if (!Array.isArray(components)) {
        singleComponent = true;
        components = [components];
    }
    return (<>
        <div className="padding-top-1">
            <h2>{<span style={{ textTransform: 'capitalize' }}>{patternType}</span>}{` Component${singleComponent ? '' : 's'}`}</h2>
        </div>
        <table className="usa-table usa-table--borderless" width="100%">
            <thead>
                <tr>
                    <th width="45%" scope="col">Name</th>
                    <th width="15%" scope="col">Type</th>
                    <th width="23%" scope="col">Profile</th>
                </tr>
            </thead>
            <tbody style={{ lineHeight: 3 }}>
                {(components && components.length > 0) ?
                    components.map((component, i) => <PatternComponentTableRow key={i} component={component} />) :
                        <tr key={1}><td className="font-sans-xs" colSpan="5">There are no components associated with this profile. Add a component to define relationships between your xAPI statements.</td></tr>
                }
            </tbody>
        </table>
    </>);
}

function PatternComponentTableRow({ component }) {
    return (
        <tr>
            <th scope="row"><a href={getURL(component)}><span>{component.component.name}</span></a></th>
            <td><span className="font-sans-3xs" style={{ textTransform: 'capitalize' }}>{(component.componentType) === 'template' ? `statement ${component.componentType}` : `${component.componentType}`}</span></td>
            <td><span className="font-sans-3xs">{component.component.parentProfile.name}</span></td>
        </tr>
    );
}

function getURL(component) {
    return "/";
}
